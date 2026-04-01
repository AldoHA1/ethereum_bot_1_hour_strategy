/**
 * ADX with DI+/DI-, matching PineScript ta.dmi(period, period)
 * Uses Wilder's smoothing (RMA)
 */
export interface ADXResult {
  adx: number[];
  diPlus: number[];
  diMinus: number[];
}

export function computeADX(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number
): ADXResult {
  const len = highs.length;
  const adx: number[] = new Array(len).fill(NaN);
  const diPlus: number[] = new Array(len).fill(NaN);
  const diMinus: number[] = new Array(len).fill(NaN);

  if (len < period * 2) return { adx, diPlus, diMinus };

  // Calculate +DM and -DM
  const plusDM: number[] = new Array(len).fill(0);
  const minusDM: number[] = new Array(len).fill(0);
  const tr: number[] = new Array(len).fill(0);

  for (let i = 1; i < len; i++) {
    const upMove = highs[i] - highs[i - 1];
    const downMove = lows[i - 1] - lows[i];

    plusDM[i] = upMove > downMove && upMove > 0 ? upMove : 0;
    minusDM[i] = downMove > upMove && downMove > 0 ? downMove : 0;

    tr[i] = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
  }

  // Wilder's smoothing for TR, +DM, -DM
  let smoothTR = 0;
  let smoothPlusDM = 0;
  let smoothMinusDM = 0;

  // Initial sums
  for (let i = 1; i <= period; i++) {
    smoothTR += tr[i];
    smoothPlusDM += plusDM[i];
    smoothMinusDM += minusDM[i];
  }

  // DI values starting at index = period
  const dx: number[] = new Array(len).fill(NaN);

  for (let i = period; i < len; i++) {
    if (i > period) {
      smoothTR = smoothTR - smoothTR / period + tr[i];
      smoothPlusDM = smoothPlusDM - smoothPlusDM / period + plusDM[i];
      smoothMinusDM = smoothMinusDM - smoothMinusDM / period + minusDM[i];
    }

    if (smoothTR > 0) {
      diPlus[i] = (smoothPlusDM / smoothTR) * 100;
      diMinus[i] = (smoothMinusDM / smoothTR) * 100;
    } else {
      diPlus[i] = 0;
      diMinus[i] = 0;
    }

    const diSum = diPlus[i] + diMinus[i];
    dx[i] = diSum > 0 ? (Math.abs(diPlus[i] - diMinus[i]) / diSum) * 100 : 0;
  }

  // ADX = RMA of DX
  let adxSum = 0;
  let adxCount = 0;
  for (let i = period; i < len; i++) {
    if (!isNaN(dx[i])) {
      adxCount++;
      if (adxCount <= period) {
        adxSum += dx[i];
        if (adxCount === period) {
          adx[i] = adxSum / period;
        }
      } else {
        adx[i] = (adx[i - 1] * (period - 1) + dx[i]) / period;
      }
    }
  }

  return { adx, diPlus, diMinus };
}

export function lastADX(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number
): { adx: number; diPlus: number; diMinus: number } {
  const r = computeADX(highs, lows, closes, period);
  const i = r.adx.length - 1;
  return {
    adx: r.adx[i],
    diPlus: r.diPlus[i],
    diMinus: r.diMinus[i],
  };
}
