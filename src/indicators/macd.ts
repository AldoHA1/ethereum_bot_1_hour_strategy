import { computeEMA } from './ema';

/**
 * MACD matching PineScript ta.macd(close, fast, slow, signal)
 */
export interface MACDResult {
  macd: number[];
  signal: number[];
  histogram: number[];
}

export function computeMACD(
  closes: number[],
  fastPeriod: number,
  slowPeriod: number,
  signalPeriod: number
): MACDResult {
  const len = closes.length;
  const macd: number[] = new Array(len).fill(NaN);
  const signal: number[] = new Array(len).fill(NaN);
  const histogram: number[] = new Array(len).fill(NaN);

  const emaFast = computeEMA(closes, fastPeriod);
  const emaSlow = computeEMA(closes, slowPeriod);

  // MACD line = EMA(fast) - EMA(slow)
  const macdLine: number[] = [];
  for (let i = 0; i < len; i++) {
    if (!isNaN(emaFast[i]) && !isNaN(emaSlow[i])) {
      macd[i] = emaFast[i] - emaSlow[i];
      macdLine.push(macd[i]);
    }
  }

  // Signal = EMA of MACD line
  if (macdLine.length >= signalPeriod) {
    const signalEMA = computeEMA(macdLine, signalPeriod);
    const offset = len - macdLine.length;

    for (let i = 0; i < signalEMA.length; i++) {
      if (!isNaN(signalEMA[i])) {
        signal[offset + i] = signalEMA[i];
        histogram[offset + i] = macd[offset + i] - signalEMA[i];
      }
    }
  }

  return { macd, signal, histogram };
}

export function lastMACD(
  closes: number[],
  fastPeriod: number,
  slowPeriod: number,
  signalPeriod: number
): { macd: number; signal: number; histogram: number } {
  const r = computeMACD(closes, fastPeriod, slowPeriod, signalPeriod);
  const i = r.macd.length - 1;
  return {
    macd: r.macd[i],
    signal: r.signal[i],
    histogram: r.histogram[i],
  };
}
