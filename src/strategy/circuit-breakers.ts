import { STRATEGY } from '../config';
import { IndicatorSnapshot } from './types';

export interface CircuitBreakerState {
  lastLossTimestamp: number;
  consecutiveWins: number;
  dailyStartEquity: number;
  currentEquity: number;
  lastDayReset: number;
}

export function createInitialCircuitState(equity: number): CircuitBreakerState {
  return {
    lastLossTimestamp: 0,
    consecutiveWins: 0,
    dailyStartEquity: equity,
    currentEquity: equity,
    lastDayReset: new Date().getUTCDate(),
  };
}

export function checkDailyReset(state: CircuitBreakerState): CircuitBreakerState {
  const today = new Date().getUTCDate();
  if (today !== state.lastDayReset) {
    return {
      ...state,
      dailyStartEquity: state.currentEquity,
      lastDayReset: today,
    };
  }
  return state;
}

export function canTrade(
  state: CircuitBreakerState,
  snapshot: IndicatorSnapshot
): { allowed: boolean; reason: string } {
  // Spread protection: ATR(3) > 3x ATR(14)
  if (STRATEGY.USE_SPREAD_PROT) {
    if (snapshot.atr3 > snapshot.atr14 * STRATEGY.SPREAD_MULT) {
      return { allowed: false, reason: 'Abnormal spread detected' };
    }
  }

  // Pause after loss
  if (STRATEGY.PAUSE_BARS_H > 0 && state.lastLossTimestamp > 0) {
    const hoursSinceLoss =
      (Date.now() - state.lastLossTimestamp) / (1000 * 60 * 60);
    if (hoursSinceLoss < STRATEGY.PAUSE_BARS_H) {
      return {
        allowed: false,
        reason: `Post-loss pause (${hoursSinceLoss.toFixed(1)}h / ${STRATEGY.PAUSE_BARS_H}h)`,
      };
    }
  }

  // Daily loss limit
  if (state.dailyStartEquity > 0) {
    const dailyPnlPct =
      ((state.currentEquity - state.dailyStartEquity) /
        state.dailyStartEquity) *
      100;
    if (dailyPnlPct <= -STRATEGY.MAX_DAILY_LOSS) {
      return {
        allowed: false,
        reason: `Daily loss limit hit: ${dailyPnlPct.toFixed(2)}%`,
      };
    }
  }

  return { allowed: true, reason: '' };
}

export function isHotStreak(state: CircuitBreakerState): boolean {
  return state.consecutiveWins >= STRATEGY.HOT_STREAK_THRESHOLD;
}

export function recordTradeResult(
  state: CircuitBreakerState,
  pnl: number
): CircuitBreakerState {
  if (pnl > 0) {
    return { ...state, consecutiveWins: state.consecutiveWins + 1 };
  } else {
    return {
      ...state,
      consecutiveWins: 0,
      lastLossTimestamp: Date.now(),
    };
  }
}
