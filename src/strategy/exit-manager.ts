import { STRATEGY } from '../config';
import { IndicatorSnapshot, ExitReason } from './types';
import { Position } from '../position/types';
import { logger } from '../utils/logger';

export interface ExitDecision {
  positionId: string;
  reason: ExitReason;
  closePercent: number; // 0-100, how much of remaining position to close
  description: string;
}

export function checkExits(
  positions: Position[],
  snapshot: IndicatorSnapshot
): ExitDecision[] {
  const decisions: ExitDecision[] = [];

  for (const pos of positions) {
    const exits = checkPositionExits(pos, snapshot);
    decisions.push(...exits);
  }

  return decisions;
}

function checkPositionExits(
  pos: Position,
  s: IndicatorSnapshot
): ExitDecision[] {
  const decisions: ExitDecision[] = [];
  const isLong = pos.side === 'long';
  const price = s.currentClose;
  const barsHeld = Math.floor((Date.now() - pos.entryTime) / (1000 * 60 * 60));

  const profitDist = isLong
    ? price - pos.entryPrice
    : pos.entryPrice - price;

  const pnlPct = isLong
    ? ((price - pos.entryPrice) / pos.entryPrice) * 100
    : ((pos.entryPrice - price) / pos.entryPrice) * 100;

  // TP1: 1.2x ATR → close 35%
  if (!pos.tp1Hit && profitDist >= pos.atrAtEntry * STRATEGY.TP1_ATR_MULT) {
    decisions.push({
      positionId: pos.id,
      reason: 'tp1',
      closePercent: STRATEGY.TP1_PCT,
      description: `TP1 hit at ${price.toFixed(2)} (+${(profitDist / pos.atrAtEntry).toFixed(1)}x ATR)`,
    });
    return decisions;
  }

  // TP2: 2.0x ATR → close 35%
  if (pos.tp1Hit && !pos.tp2Hit && profitDist >= pos.atrAtEntry * STRATEGY.TP2_ATR_MULT) {
    decisions.push({
      positionId: pos.id,
      reason: 'tp2',
      closePercent: STRATEGY.TP2_PCT,
      description: `TP2 hit at ${price.toFixed(2)} (+${(profitDist / pos.atrAtEntry).toFixed(1)}x ATR)`,
    });
    return decisions;
  }

  // TP3: 3.5x ATR → close remaining
  if (
    pos.tp1Hit &&
    pos.tp2Hit &&
    !pos.tp3Hit &&
    profitDist >= pos.atrAtEntry * STRATEGY.TP3_ATR_MULT
  ) {
    decisions.push({
      positionId: pos.id,
      reason: 'tp3',
      closePercent: 100,
      description: `TP3 hit at ${price.toFixed(2)} (+${(profitDist / pos.atrAtEntry).toFixed(1)}x ATR)`,
    });
    return decisions;
  }

  // Stop Loss: 1.5x ATR
  if (profitDist <= -pos.atrAtEntry * STRATEGY.SL_ATR_MULT) {
    decisions.push({
      positionId: pos.id,
      reason: 'stop_loss',
      closePercent: 100,
      description: `SL hit at ${price.toFixed(2)} (${(profitDist / pos.atrAtEntry).toFixed(1)}x ATR)`,
    });
    return decisions;
  }

  // Breakeven stop: after +0.8x ATR, SL moves to entry
  if (pos.breakevenActive && profitDist < 0) {
    decisions.push({
      positionId: pos.id,
      reason: 'breakeven_stop',
      closePercent: 100,
      description: `Breakeven stop hit at ${price.toFixed(2)}`,
    });
    return decisions;
  }

  // Trailing stop (after TP2, for remaining position)
  if (
    STRATEGY.USE_TRAILING &&
    pos.tp2Hit &&
    pos.trailingStop !== null &&
    pos.trailingStop > 0
  ) {
    const trailHit = isLong
      ? price <= pos.trailingStop
      : price >= pos.trailingStop;
    if (trailHit) {
      decisions.push({
        positionId: pos.id,
        reason: 'trailing_stop',
        closePercent: 100,
        description: `Trailing stop hit at ${price.toFixed(2)} (trail=${pos.trailingStop.toFixed(2)})`,
      });
      return decisions;
    }
  }

  // MA cross exit: if MA9 crosses against position direction, close if profitable
  if (barsHeld >= 2 && pnlPct > 0.2) {
    if (isLong && s.ma9 < s.ma21 && s.ma9Prev1 >= s.ma21Prev1) {
      decisions.push({
        positionId: pos.id,
        reason: 'ma_cross_exit',
        closePercent: 100,
        description: `MA cross exit: MA9 crossed below MA21`,
      });
      return decisions;
    }
    if (!isLong && s.ma9 > s.ma21 && s.ma9Prev1 <= s.ma21Prev1) {
      decisions.push({
        positionId: pos.id,
        reason: 'ma_cross_exit',
        closePercent: 100,
        description: `MA cross exit: MA9 crossed above MA21`,
      });
      return decisions;
    }
  }

  // Timeout
  if (STRATEGY.USE_TIME_EXIT && barsHeld >= STRATEGY.MAX_BARS_H) {
    decisions.push({
      positionId: pos.id,
      reason: 'timeout',
      closePercent: 100,
      description: `Timeout after ${barsHeld}h`,
    });
    return decisions;
  }

  return decisions;
}

/**
 * Update trailing stop and breakeven levels for positions
 */
export function updatePositionLevels(
  pos: Position,
  snapshot: IndicatorSnapshot
): Position {
  const isLong = pos.side === 'long';
  const price = snapshot.currentClose;
  const profitDist = isLong
    ? price - pos.entryPrice
    : pos.entryPrice - price;

  let updated = { ...pos };

  // Breakeven: at +0.8x ATR, activate breakeven
  if (!pos.breakevenActive && profitDist >= pos.atrAtEntry * STRATEGY.BREAKEVEN_ATR) {
    updated.breakevenActive = true;
    logger.info(
      `Position ${pos.id}: Breakeven activated at ${price.toFixed(2)}`
    );
  }

  // Trailing stop: activate at +1.0x ATR after TP1
  if (STRATEGY.USE_TRAILING && pos.tp1Hit) {
    if (profitDist >= pos.atrAtEntry * STRATEGY.TRAIL_ATR_MULT) {
      const offset = pos.atrAtEntry * STRATEGY.TRAIL_OFFSET_ATR;
      const newTrail = isLong
        ? Math.max(pos.trailingStop || 0, price - offset)
        : pos.trailingStop === null
          ? price + offset
          : Math.min(pos.trailingStop, price + offset);

      if (newTrail !== pos.trailingStop) {
        updated.trailingStop = newTrail;
      }
    }
  }

  return updated;
}
