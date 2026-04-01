import { Candle } from '../data/candle-store';

/**
 * VWAP with daily reset (matches PineScript ta.vwap)
 * Resets at 00:00 UTC each day
 */
export function computeVWAP(candles: Candle[]): number[] {
  const result: number[] = new Array(candles.length).fill(NaN);
  let cumTPV = 0;
  let cumVol = 0;
  let currentDay = -1;

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const day = new Date(c.time).getUTCDate();
    const month = new Date(c.time).getUTCMonth();
    const dayKey = month * 31 + day;

    if (dayKey !== currentDay) {
      cumTPV = 0;
      cumVol = 0;
      currentDay = dayKey;
    }

    const tp = (c.high + c.low + c.close) / 3;
    cumTPV += tp * c.volume;
    cumVol += c.volume;

    result[i] = cumVol > 0 ? cumTPV / cumVol : c.close;
  }

  return result;
}

export function lastVWAP(candles: Candle[]): number {
  const vwap = computeVWAP(candles);
  return vwap[vwap.length - 1];
}
