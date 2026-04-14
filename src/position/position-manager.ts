import { STRATEGY, KRAKEN } from '../config';
import { Position, createPosition } from './types';
import { calculatePositionSize } from './position-sizer';
import { Signal } from '../strategy/types';
import { IndicatorSnapshot } from '../strategy/types';
import { ExitDecision } from '../strategy/exit-manager';
import * as orderManager from '../exchange/order-manager';
import * as rest from '../exchange/rest-client';
import { CircuitBreakerState, isHotStreak } from '../strategy/circuit-breakers';
import { logger } from '../utils/logger';
import { roundDown } from '../utils/math';

export class PositionManager {
  private positions: Position[] = [];

  getPositions(): Position[] {
    return [...this.positions];
  }

  getOpenCount(): number {
    return this.positions.length;
  }

  updatePosition(posId: string, updates: Partial<Position>): void {
    const idx = this.positions.findIndex((p) => p.id === posId);
    if (idx >= 0) {
      this.positions[idx] = { ...this.positions[idx], ...updates };
    }
  }

  async executeEntry(
    signal: Signal,
    snapshot: IndicatorSnapshot,
    cbState: CircuitBreakerState
  ): Promise<Position | null> {
    // Spot trading only supports long positions — selling requires holding ETH
    if (signal.side === 'short') {
      logger.warn('Short entry rejected — not supported on spot. Use exit logic to close longs.');
      return null;
    }

    // Check pyramiding limit
    const canScaleIn =
      STRATEGY.USE_SCALE_IN &&
      this.positions.some(
        (p) =>
          p.side === signal.side &&
          (signal.side === 'long'
            ? snapshot.currentClose > p.entryPrice
            : snapshot.currentClose < p.entryPrice)
      );

    if (this.positions.length >= STRATEGY.MAX_OPEN_TRADES && !canScaleIn) {
      logger.debug('Max positions reached, no scale-in available');
      return null;
    }

    const equity = cbState.currentEquity;

    // Fetch available USD balance to prevent insufficient funds errors
    let availableBalance = equity;
    try {
      const tradeBalance = await rest.getTradeBalance();
      availableBalance = parseFloat(tradeBalance.mf) || equity;
    } catch (err) {
      logger.warn(`Failed to fetch available balance, using equity: ${err}`);
    }

    const qty = calculatePositionSize({
      equity,
      availableBalance,
      isHotStreak: isHotStreak(cbState),
      atr: snapshot.atr14,
      entryPrice: snapshot.currentClose,
    });

    if (qty < KRAKEN.MIN_ORDER_ETH) return null;

    // Calculate SL price for the close order
    const slDist = snapshot.atr14 * STRATEGY.SL_ATR_MULT;
    const slPrice =
      signal.side === 'long'
        ? snapshot.currentClose - slDist
        : snapshot.currentClose + slDist;

    const side = signal.side === 'long' ? 'buy' : 'sell';
    const result = await orderManager.placeMarketOrder(side, qty);

    if (!result) return null;

    // Place stop-loss as a separate order so we control its lifecycle
    const slSide = signal.side === 'long' ? 'sell' : 'buy';
    const slResult = await orderManager.placeStopLoss(slSide, qty, slPrice);

    const pos = createPosition({
      side: signal.side,
      entryPrice: snapshot.currentClose,
      qty,
      atr: snapshot.atr14,
      orderTxid: result.txid,
    });

    if (slResult) {
      pos.slOrderId = slResult.txid;
    }

    this.positions.push(pos);
    logger.info(
      `Position opened: ${pos.id} ${signal.side.toUpperCase()} ` +
        `qty=${qty.toFixed(6)} entry=${snapshot.currentClose.toFixed(2)} ` +
        `SL=${slPrice.toFixed(2)}`
    );

    return pos;
  }

  async executeExit(decision: ExitDecision): Promise<number> {
    const pos = this.positions.find((p) => p.id === decision.positionId);
    if (!pos) {
      logger.warn(`Position ${decision.positionId} not found for exit`);
      return 0;
    }

    const closeQty =
      decision.closePercent === 100
        ? pos.remainingQty
        : roundDown((pos.remainingQty * decision.closePercent) / 100, 8);

    if (closeQty < KRAKEN.MIN_ORDER_ETH) {
      // If remaining is too small to partially close, close all
      if (pos.remainingQty >= KRAKEN.MIN_ORDER_ETH) {
        return this.closeFullPosition(pos, decision);
      }
      logger.warn(
        `Cannot close ${closeQty} ETH (below min), skipping exit for ${pos.id}`
      );
      return 0;
    }

    // Cancel stop-loss BEFORE selling to release reserved funds on Kraken
    if (pos.slOrderId) {
      await orderManager.cancelOrderById(pos.slOrderId);
      pos.slOrderId = null;
    } else {
      await orderManager.cancelOpenStopLosses(KRAKEN.ETH_PAIR);
    }

    const side = pos.side === 'long' ? 'sell' : 'buy';
    const result = await orderManager.placeMarketOrder(side, closeQty);

    if (!result) return 0;

    pos.remainingQty -= closeQty;
    pos.krakenOrderIds.push(result.txid);

    // Mark TP levels
    if (decision.reason === 'tp1') pos.tp1Hit = true;
    if (decision.reason === 'tp2') pos.tp2Hit = true;
    if (decision.reason === 'tp3') pos.tp3Hit = true;

    logger.info(
      `Exit executed: ${pos.id} ${decision.reason} closed=${closeQty.toFixed(6)} ` +
        `remaining=${pos.remainingQty.toFixed(6)} — ${decision.description}`
    );

    // Remove position if fully closed
    if (pos.remainingQty < KRAKEN.MIN_ORDER_ETH) {
      this.removePosition(pos.id);
    } else {
      // Re-place stop-loss for remaining qty
      const slSide = pos.side === 'long' ? 'sell' : 'buy';
      const slPrice = this.calculateStopLossPrice(pos);
      const slResult = await orderManager.placeStopLoss(slSide, pos.remainingQty, slPrice);
      if (slResult) {
        pos.slOrderId = slResult.txid;
      }
    }

    return closeQty;
  }

  private async closeFullPosition(
    pos: Position,
    decision: ExitDecision
  ): Promise<number> {
    // Cancel stop-loss BEFORE selling to release reserved funds on Kraken
    if (pos.slOrderId) {
      await orderManager.cancelOrderById(pos.slOrderId);
      pos.slOrderId = null;
    } else {
      await orderManager.cancelOpenStopLosses(KRAKEN.ETH_PAIR);
    }

    const side = pos.side === 'long' ? 'sell' : 'buy';
    const result = await orderManager.placeMarketOrder(side, pos.remainingQty);

    if (!result) return 0;

    const qty = pos.remainingQty;
    logger.info(
      `Full exit: ${pos.id} ${decision.reason} closed=${qty.toFixed(6)} — ${decision.description}`
    );

    this.removePosition(pos.id);
    return qty;
  }

  private calculateStopLossPrice(pos: Position): number {
    if (pos.trailingStop !== null) {
      return pos.trailingStop;
    }
    if (pos.breakevenActive) {
      return pos.entryPrice;
    }
    const slDist = pos.atrAtEntry * STRATEGY.SL_ATR_MULT;
    return pos.side === 'long'
      ? pos.entryPrice - slDist
      : pos.entryPrice + slDist;
  }

  private removePosition(posId: string): void {
    this.positions = this.positions.filter((p) => p.id !== posId);
  }

  // For state persistence
  toJSON(): Position[] {
    return this.positions;
  }

  loadFromJSON(positions: Position[]): void {
    this.positions = positions;
  }
}
