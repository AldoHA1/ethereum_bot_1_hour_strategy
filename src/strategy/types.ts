export type SignalSide = 'long' | 'short';
export type EntryMode = 'mean_reversion' | 'trend';
export type ExitReason =
  | 'tp1'
  | 'tp2'
  | 'tp3'
  | 'stop_loss'
  | 'trailing_stop'
  | 'breakeven_stop'
  | 'rsi_stoch_exit'
  | 'ribbon_exit'
  | 'vwap_exit'
  | 'timeout';

export interface Signal {
  side: SignalSide;
  mode: EntryMode;
  isHighQuality: boolean;
}

export interface IndicatorSnapshot {
  // 1H ETH
  rsi: number;
  rsiPrev1: number;
  rsiPrev2: number;
  stochK: number;
  stochD: number;
  stochKPrev1: number;
  stochDPrev1: number;
  stochKPrev2: number;
  stochDPrev2: number;
  emaFast: number;
  emaMid: number;
  emaSlow: number;
  ema200: number;
  emaFastPrev1: number;
  emaFastPrev2: number;
  emaMidPrev1: number;
  emaMidPrev3: number;
  vwap: number;
  adx: number;
  diPlus: number;
  diMinus: number;
  macdLine: number;
  macdSignal: number;
  macdHist: number;
  macdHistPrev1: number;
  atr14: number;
  atr3: number;
  volumeMa: number;
  currentVolume: number;
  currentClose: number;
  currentOpen: number;
  currentHigh: number;
  currentLow: number;
  prevClose: number;

  // 4H ETH
  eth4hEmaFast: number;
  eth4hEmaMid: number;
  eth4hRsi: number;

  // BTC 4H
  btcClose4h: number;
  btcPrev4h: number;
  btcEma4h: number;
}
