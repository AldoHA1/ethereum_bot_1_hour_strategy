export type SignalSide = 'long' | 'short';
export type ExitReason =
  | 'tp1'
  | 'tp2'
  | 'tp3'
  | 'stop_loss'
  | 'trailing_stop'
  | 'breakeven_stop'
  | 'ma_cross_exit'
  | 'timeout';

export interface Signal {
  side: SignalSide;
}

export interface IndicatorSnapshot {
  ma9: number;
  ma9Prev1: number;
  ma21: number;
  ma21Prev1: number;
  atr14: number;
  currentClose: number;
  currentOpen: number;
  currentHigh: number;
  currentLow: number;
  prevClose: number;
}
