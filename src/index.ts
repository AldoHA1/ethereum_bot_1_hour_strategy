import { ENV, KRAKEN, STRATEGY } from './config';
import { KrakenWsClient } from './exchange/ws-client';
import * as rest from './exchange/rest-client';
import { DataFeed } from './data/data-feed';
import { Candle } from './data/candle-store';
import {
  buildSnapshot,
  evaluateSignal,
  logSnapshot,
} from './strategy/signal-engine';
import {
  checkExits,
  updatePositionLevels,
} from './strategy/exit-manager';
import {
  canTrade,
  checkDailyReset,
  recordTradeResult,
  CircuitBreakerState,
} from './strategy/circuit-breakers';
import { PositionManager } from './position/position-manager';
import { BotStateData, createInitialState } from './state/bot-state';
import { saveState, loadState } from './state/persistence';
import { logger } from './utils/logger';
import { recordTrade } from './utils/trade-journal';

class TradingBot {
  private ws!: KrakenWsClient;
  private dataFeed!: DataFeed;
  private positionManager = new PositionManager();
  private state!: BotStateData;
  private reconcileInterval: NodeJS.Timeout | null = null;
  private dailyResetInterval: NodeJS.Timeout | null = null;

  async start(): Promise<void> {
    logger.info('========================================');
    logger.info('ETH/USD 5M MA Crossover Bot - Starting');
    logger.info(`Mode: ${ENV.dryRun ? 'DRY RUN' : 'LIVE'}`);
    logger.info(`Strategy: MA(${STRATEGY.MA_FAST}) x MA(${STRATEGY.MA_SLOW})`);
    logger.info('========================================');

    // Step 1: Get balance and initialize state
    const equity = await this.getEquity();
    logger.info(`Current equity: $${equity.toFixed(2)}`);

    // Load persisted state or create new
    const savedState = loadState();
    if (savedState) {
      this.state = savedState;
      this.state.circuitBreaker.currentEquity = equity;
      this.positionManager.loadFromJSON(savedState.positions);
      logger.info(
        `Resumed state: ${this.positionManager.getOpenCount()} open positions`
      );
    } else {
      this.state = createInitialState(equity);
      logger.info('Created fresh state');
    }

    // Step 2: Initialize WebSocket
    this.ws = new KrakenWsClient(KRAKEN.WS_PUBLIC_URL);
    this.dataFeed = new DataFeed(this.ws);

    // Step 3: Backfill historical candles
    await this.dataFeed.backfill();

    // Step 4: Verify indicators are calculable
    const testSnapshot = buildSnapshot(this.dataFeed.ethStore5m);
    if (testSnapshot) {
      logger.info('Indicator computation verified successfully');
      logSnapshot(testSnapshot);
    } else {
      logger.error('Failed to compute indicators - insufficient data');
      process.exit(1);
    }

    // Step 5: Connect WebSocket and subscribe
    this.ws.connect();

    this.ws.on('connected', () => {
      this.dataFeed.subscribeToCandles();
    });

    // Step 6: Register candle close handler
    this.dataFeed.on('eth_candle_close', (candle: Candle) => {
      this.onCandleClose(candle).catch((err) => {
        logger.error(`Error processing candle: ${err}`);
      });
    });

    // Step 7: Start periodic tasks
    this.startPeriodicTasks();

    // Step 8: Graceful shutdown
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());

    logger.info('Bot is running. Waiting for candle closes...');
  }

  private async onCandleClose(candle: Candle): Promise<void> {
    logger.info(
      `--- Candle closed: ${new Date(candle.time).toISOString()} ` +
        `O=${candle.open.toFixed(2)} H=${candle.high.toFixed(2)} ` +
        `L=${candle.low.toFixed(2)} C=${candle.close.toFixed(2)} V=${candle.volume.toFixed(2)}`
    );

    // Build indicator snapshot
    const snapshot = buildSnapshot(this.dataFeed.ethStore5m);

    if (!snapshot) {
      logger.warn('Insufficient data for snapshot, skipping');
      return;
    }

    logSnapshot(snapshot);

    // Check daily reset
    this.state.circuitBreaker = checkDailyReset(this.state.circuitBreaker);

    // Update position levels (breakeven, trailing)
    const positions = this.positionManager.getPositions();
    for (const pos of positions) {
      const updated = updatePositionLevels(pos, snapshot);
      this.positionManager.updatePosition(pos.id, updated);
    }

    // Check exits for existing positions
    const currentPositions = this.positionManager.getPositions();
    const exitDecisions = checkExits(currentPositions, snapshot);

    for (const decision of exitDecisions) {
      const pos = currentPositions.find((p) => p.id === decision.positionId);
      if (!pos) continue;

      const closedQty = await this.positionManager.executeExit(decision);

      if (closedQty > 0) {
        // Estimate fees
        const feesEst =
          closedQty * snapshot.currentClose * KRAKEN.TAKER_FEE +
          closedQty * pos.entryPrice * KRAKEN.TAKER_FEE;

        // Calculate PnL for circuit breaker
        const pnlPerUnit =
          pos.side === 'long'
            ? snapshot.currentClose - pos.entryPrice
            : pos.entryPrice - snapshot.currentClose;
        const pnl = pnlPerUnit * closedQty - feesEst;

        // Update equity
        this.state.circuitBreaker.currentEquity += pnl;

        // Record result if position fully closed
        if (decision.closePercent === 100) {
          this.state.circuitBreaker = recordTradeResult(
            this.state.circuitBreaker,
            pnl
          );
        }

        // Record trade in journal
        recordTrade({
          position: pos,
          exitPrice: snapshot.currentClose,
          exitQty: closedQty,
          exitReason: decision.reason,
          feesEst,
          equityAfter: this.state.circuitBreaker.currentEquity,
        });
      }
    }

    // Check circuit breakers for new entries
    const { allowed, reason } = canTrade(this.state.circuitBreaker);

    if (!allowed) {
      logger.info(`Trading paused: ${reason}`);
      this.persistState();
      return;
    }

    // Evaluate signals for new entries
    const signal = evaluateSignal(snapshot);

    if (signal) {
      logger.info(`Signal: ${signal.side.toUpperCase()} (MA crossover)`);

      const pos = await this.positionManager.executeEntry(
        signal,
        snapshot,
        this.state.circuitBreaker
      );

      if (pos) {
        logger.info(`New position opened: ${pos.id}`);
      }
    }

    // Persist state
    this.persistState();
  }

  private async getEquity(): Promise<number> {
    try {
      const tradeBalance = await rest.getTradeBalance();
      return parseFloat(tradeBalance.e) || STRATEGY.INITIAL_CAPITAL;
    } catch (err) {
      logger.warn(`Failed to get trade balance: ${err}, using initial capital`);
      return STRATEGY.INITIAL_CAPITAL;
    }
  }

  private startPeriodicTasks(): void {
    // Refresh equity every 5 minutes
    this.reconcileInterval = setInterval(async () => {
      try {
        const equity = await this.getEquity();
        this.state.circuitBreaker.currentEquity = equity;
        logger.debug(`Equity refreshed: $${equity.toFixed(2)}`);
      } catch (err) {
        logger.warn(`Equity refresh failed: ${err}`);
      }
    }, 5 * 60 * 1000);

    // Daily reset check every minute
    this.dailyResetInterval = setInterval(() => {
      this.state.circuitBreaker = checkDailyReset(this.state.circuitBreaker);
    }, 60 * 1000);
  }

  private persistState(): void {
    this.state.positions = this.positionManager.toJSON();
    this.state.lastProcessedCandleTime =
      this.dataFeed.ethStore5m.lastProcessedTime();
    saveState(this.state);
  }

  private shutdown(): void {
    logger.info('Shutting down...');

    if (this.reconcileInterval) clearInterval(this.reconcileInterval);
    if (this.dailyResetInterval) clearInterval(this.dailyResetInterval);

    this.persistState();
    this.ws?.close();

    logger.info(
      `Shutdown complete. ${this.positionManager.getOpenCount()} positions remain open (SL orders active on Kraken).`
    );
    process.exit(0);
  }
}

// Entry point
const bot = new TradingBot();
bot.start().catch((err) => {
  logger.error(`Fatal error: ${err}`);
  process.exit(1);
});
