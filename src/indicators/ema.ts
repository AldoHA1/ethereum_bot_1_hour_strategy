/**
 * Exponential Moving Average
 * Matches PineScript ta.ema: multiplier = 2 / (period + 1), SMA seed
 */
export function computeEMA(values: number[], period: number): number[] {
  if (values.length < period) return [];

  const result: number[] = new Array(values.length).fill(NaN);
  const mult = 2 / (period + 1);

  // SMA seed
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += values[i];
  }
  result[period - 1] = sum / period;

  // EMA
  for (let i = period; i < values.length; i++) {
    result[i] = values[i] * mult + result[i - 1] * (1 - mult);
  }

  return result;
}

export function lastEMA(values: number[], period: number): number {
  const ema = computeEMA(values, period);
  return ema[ema.length - 1];
}
