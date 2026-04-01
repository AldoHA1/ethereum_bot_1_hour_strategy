import { computeSMA } from './volume-ma';

/**
 * Stochastic Oscillator matching PineScript:
 *   raw_k = ta.stoch(close, high, low, kPeriod)
 *   k = ta.sma(raw_k, smoothK)
 *   d = ta.sma(k, dPeriod)
 */
export function computeStochastic(
  closes: number[],
  highs: number[],
  lows: number[],
  kPeriod: number,
  smoothK: number,
  dPeriod: number
): { k: number[]; d: number[] } {
  const len = closes.length;
  if (len < kPeriod) return { k: [], d: [] };

  // Raw %K
  const rawK: number[] = new Array(len).fill(NaN);
  for (let i = kPeriod - 1; i < len; i++) {
    let hh = -Infinity;
    let ll = Infinity;
    for (let j = i - kPeriod + 1; j <= i; j++) {
      if (highs[j] > hh) hh = highs[j];
      if (lows[j] < ll) ll = lows[j];
    }
    const range = hh - ll;
    rawK[i] = range > 0 ? ((closes[i] - ll) / range) * 100 : 50;
  }

  // Smooth %K with SMA
  const validRawK = rawK.filter((v) => !isNaN(v));
  const smoothedK = computeSMA(validRawK, smoothK);

  // Map back to full-length array
  const k: number[] = new Array(len).fill(NaN);
  const startIdx = kPeriod - 1 + smoothK - 1;
  for (let i = 0; i < smoothedK.length; i++) {
    if (!isNaN(smoothedK[i])) {
      k[startIdx + i - (smoothK - 1) + (smoothK - 1)] = smoothedK[i];
    }
  }

  // Rebuild k properly
  const kResult: number[] = new Array(len).fill(NaN);
  let kIdx = 0;
  for (let i = kPeriod - 1; i < len; i++) {
    if (!isNaN(rawK[i])) {
      // running SMA of smoothK
      if (kIdx >= smoothK - 1) {
        let sum = 0;
        let count = 0;
        for (let j = 0; j < smoothK; j++) {
          const idx = i - j;
          if (idx >= 0 && !isNaN(rawK[idx])) {
            sum += rawK[idx];
            count++;
          }
        }
        if (count === smoothK) {
          kResult[i] = sum / smoothK;
        }
      }
      kIdx++;
    }
  }

  // %D = SMA of %K
  const dResult: number[] = new Array(len).fill(NaN);
  for (let i = 0; i < len; i++) {
    if (!isNaN(kResult[i])) {
      let sum = 0;
      let count = 0;
      for (let j = 0; j < dPeriod; j++) {
        const idx = i - j;
        if (idx >= 0 && !isNaN(kResult[idx])) {
          sum += kResult[idx];
          count++;
        }
      }
      if (count === dPeriod) {
        dResult[i] = sum / dPeriod;
      }
    }
  }

  return { k: kResult, d: dResult };
}

export function lastStochastic(
  closes: number[],
  highs: number[],
  lows: number[],
  kPeriod: number,
  smoothK: number,
  dPeriod: number
): { k: number; d: number } {
  const { k, d } = computeStochastic(
    closes,
    highs,
    lows,
    kPeriod,
    smoothK,
    dPeriod
  );
  return {
    k: k[k.length - 1],
    d: d[d.length - 1],
  };
}
