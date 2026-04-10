import { STRATEGY } from '../config';
import { CandleStore } from '../data/candle-store';
import { computeSMA, computeATR } from '../indicators';
import { IndicatorSnapshot, Signal } from './types';
import { logger } from '../utils/logger';

export function buildSnapshot(store: CandleStore): IndicatorSnapshot | null {
  const candles = store.getAll();
  if (candles.length < STRATEGY.MA_SLOW + 10) {
    logger.debug(
      `Not enough candles for snapshot: ${candles.length}/${STRATEGY.MA_SLOW + 10}`
    );
    return null;
  }

  const closes = store.closes();
  const highs = store.highs();
  const lows = store.lows();
  const opens = store.opens();
  const len = closes.length;

  const last = (arr: number[]) => arr[len - 1];
  const prev = (arr: number[], off: number) =>
    len - 1 - off >= 0 ? arr[len - 1 - off] : NaN;

  const ma9 = computeSMA(closes, STRATEGY.MA_FAST);
  const ma21 = computeSMA(closes, STRATEGY.MA_SLOW);
  const atr14 = computeATR(highs, lows, closes, STRATEGY.ATR_PERIOD);

  return {
    ma9: last(ma9),
    ma9Prev1: prev(ma9, 1),
    ma21: last(ma21),
    ma21Prev1: prev(ma21, 1),
    atr14: last(atr14),
    currentClose: closes[len - 1],
    currentOpen: opens[len - 1],
    currentHigh: highs[len - 1],
    currentLow: lows[len - 1],
    prevClose: prev(closes, 1),
  };
}

export function evaluateSignal(snapshot: IndicatorSnapshot): Signal | null {
  // MA(9) crosses above MA(21) → long
  if (snapshot.ma9 > snapshot.ma21 && snapshot.ma9Prev1 <= snapshot.ma21Prev1) {
    return { side: 'long' };
  }

  // MA(9) crosses below MA(21) → short
  if (snapshot.ma9 < snapshot.ma21 && snapshot.ma9Prev1 >= snapshot.ma21Prev1) {
    return { side: 'short' };
  }

  return null;
}

export function logSnapshot(snapshot: IndicatorSnapshot): void {
  logger.debug(
    `Indicators: MA9=${snapshot.ma9?.toFixed(2)} MA21=${snapshot.ma21?.toFixed(2)} ` +
      `ATR14=${snapshot.atr14?.toFixed(2)} Close=${snapshot.currentClose?.toFixed(2)}`
  );
}
