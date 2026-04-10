import { STRATEGY } from '../config';

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
  state: CircuitBreakerState
): { allowed: boolean; reason: string } {
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
