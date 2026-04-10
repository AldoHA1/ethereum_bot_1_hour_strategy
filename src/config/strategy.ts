export const STRATEGY = {
  // Moving Averages
  MA_FAST: 9,
  MA_SLOW: 21,

  // ATR (for exits/risk management)
  ATR_PERIOD: 14,

  // Exits - TP (ATR multiples)
  TP1_ATR_MULT: 1.2,
  TP2_ATR_MULT: 2.0,
  TP3_ATR_MULT: 3.5,
  TP1_PCT: 35,
  TP2_PCT: 35,
  // TP3_PCT = 100 - TP1 - TP2 = 30

  // SL
  SL_ATR_MULT: 1.5,

  // Trailing
  USE_TRAILING: true,
  TRAIL_ATR_MULT: 1.0,
  TRAIL_OFFSET_ATR: 0.6,

  // Breakeven
  BREAKEVEN_ATR: 0.8,

  // Time exit
  USE_TIME_EXIT: true,
  MAX_BARS_H: 24,

  // Risk & Sizing
  MAX_OPEN_TRADES: 4,
  RISK_PCT: 1.5,
  USE_COMPOUND: true,
  USE_SCALE_IN: true,
  PAUSE_BARS_H: 3,
  MAX_DAILY_LOSS: 4.0,

  // Hot streak
  HOT_STREAK_THRESHOLD: 3,
  HOT_STREAK_MULT: 1.25,

  // Initial capital reference
  INITIAL_CAPITAL: 1000,
  COMMISSION_PCT: 0.04,
} as const;
