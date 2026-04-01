import { STRATEGY } from '../config';
import { CandleStore } from '../data/candle-store';
import { computeEMA, computeRSI } from '../indicators';

/**
 * Multi-Timeframe analysis
 * Computes 4H EMA(9), EMA(21), RSI(14) for ETH
 * Computes BTC 4H close, EMA(21), and % change
 */
export interface MTFData {
  eth4hEmaFast: number;
  eth4hEmaMid: number;
  eth4hRsi: number;
  btcClose4h: number;
  btcPrev4h: number;
  btcEma4h: number;
}

export function computeMTF(
  eth4hStore: CandleStore,
  btc4hStore: CandleStore
): MTFData {
  const eth4h = eth4hStore.getAll();
  const btc4h = btc4hStore.getAll();

  // ETH 4H indicators
  const eth4hCloses = eth4h.map((c) => c.close);
  const eth4hEmaFastArr = computeEMA(eth4hCloses, STRATEGY.MTF_EMA_FAST);
  const eth4hEmaMidArr = computeEMA(eth4hCloses, STRATEGY.MTF_EMA_SLOW);
  const eth4hRsiArr = computeRSI(eth4hCloses, STRATEGY.MTF_RSI_PERIOD);

  // BTC 4H indicators
  const btc4hCloses = btc4h.map((c) => c.close);
  const btc4hEmaArr = computeEMA(btc4hCloses, STRATEGY.MTF_EMA_SLOW);

  const last = (arr: number[]): number =>
    arr.length > 0 ? arr[arr.length - 1] : NaN;
  const prev = (arr: number[], offset: number): number => {
    const idx = arr.length - 1 - offset;
    return idx >= 0 ? arr[idx] : NaN;
  };

  // BTC lookback for % change
  const btcLookback = STRATEGY.BTC_LOOKBACK_4H;
  const btcClose = last(btc4hCloses);
  const btcPrevIdx = btc4hCloses.length - 1 - btcLookback;
  const btcPrev = btcPrevIdx >= 0 ? btc4hCloses[btcPrevIdx] : btcClose;

  return {
    eth4hEmaFast: last(eth4hEmaFastArr),
    eth4hEmaMid: last(eth4hEmaMidArr),
    eth4hRsi: last(eth4hRsiArr),
    btcClose4h: btcClose,
    btcPrev4h: btcPrev,
    btcEma4h: last(btc4hEmaArr),
  };
}
