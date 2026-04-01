export const STRATEGY = {
  // RSI
  RSI_PERIOD: 7,
  RSI_OVERBOUGHT: 72,
  RSI_OVERSOLD: 28,

  // Stochastic
  STOCH_K: 5,
  STOCH_D: 3,
  STOCH_SMOOTH: 3,

  // EMAs
  EMA_FAST: 9,
  EMA_MID: 21,
  EMA_SLOW: 50,
  EMA_MACRO: 200,
  USE_EMA200: true,

  // VWAP
  USE_VWAP: true,

  // ADX
  ADX_PERIOD: 14,
  ADX_MAX_MR: 30,
  ADX_MIN_TREND: 25,
  USE_ADX_FILTER: true,
  USE_TREND_MODE: true,

  // MACD
  MACD_FAST: 12,
  MACD_SLOW: 26,
  MACD_SIGNAL: 9,

  // ATR
  ATR_PERIOD: 14,
  ATR_FAST: 3,

  // Volume
  USE_VOL_FILTER: true,
  VOL_MULT: 0.9,
  VOL_MA_LEN: 24,

  // Candle confirmation
  USE_CANDLE_CONF: true,

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

  // RSI exit
  USE_RSI_EXIT: true,

  // Time exit
  USE_TIME_EXIT: true,
  MAX_BARS_H: 24,

  // Risk & Sizing
  MAX_OPEN_TRADES: 4,
  RISK_PCT_BASE: 1.5,
  RISK_PCT_HQ: 2.5,
  USE_COMPOUND: true,
  USE_SCALE_IN: true,
  PAUSE_BARS_H: 3,
  MAX_DAILY_LOSS: 4.0,

  // Hot streak
  HOT_STREAK_THRESHOLD: 3,
  HOT_STREAK_MULT: 1.25,

  // BTC filter
  USE_BTC_FILTER: true,
  BTC_DROP_PCT: 2.0,
  BTC_LOOKBACK_4H: 4,

  // Spread protection
  USE_SPREAD_PROT: true,
  SPREAD_MULT: 3.0,

  // MTF
  MTF_EMA_FAST: 9,
  MTF_EMA_SLOW: 21,
  MTF_RSI_PERIOD: 14,

  // Initial capital reference
  INITIAL_CAPITAL: 1000,
  COMMISSION_PCT: 0.04,
} as const;
