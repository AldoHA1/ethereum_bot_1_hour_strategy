/**
 * ATR using Wilder's smoothing (RMA), matching PineScript ta.atr
 */
export function computeATR(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number
): number[] {
  const len = highs.length;
  if (len < 2) return [];

  const result: number[] = new Array(len).fill(NaN);

  // True Range
  const tr: number[] = new Array(len).fill(0);
  tr[0] = highs[0] - lows[0];
  for (let i = 1; i < len; i++) {
    tr[i] = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
  }

  // RMA (Wilder's smoothing)
  if (len < period) return result;

  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += tr[i];
  }
  result[period - 1] = sum / period;

  for (let i = period; i < len; i++) {
    result[i] = (result[i - 1] * (period - 1) + tr[i]) / period;
  }

  return result;
}

export function lastATR(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number
): number {
  const atr = computeATR(highs, lows, closes, period);
  return atr[atr.length - 1];
}
