import { STRATEGY } from '../config';
import { IndicatorSnapshot, Signal } from './types';

/**
 * Trend following entry conditions (ADX >= 25)
 * Matching PineScript logic exactly
 */
export function checkTrend(s: IndicatorSnapshot): Signal | null {
  if (!STRATEGY.USE_TREND_MODE) return null;

  // ADX must indicate trending
  if (s.adx < STRATEGY.ADX_MIN_TREND) return null;

  const longSignal = checkTrendLong(s);
  if (longSignal) return longSignal;

  const shortSignal = checkTrendShort(s);
  if (shortSignal) return shortSignal;

  return null;
}

function checkTrendLong(s: IndicatorSnapshot): Signal | null {
  // EMA ribbon bullish: EMA9 > EMA21 > EMA50, close > EMA9
  const ribbonBull =
    s.emaFast > s.emaMid && s.emaMid > s.emaSlow && s.currentClose > s.emaFast;
  if (!ribbonBull) return null;

  // MACD trend confirming
  const macdBullTrend =
    s.macdLine > s.macdSignal && s.macdHist > 0;
  if (!macdBullTrend) return null;

  // RSI in favorable zone
  const rsiBullTrend = s.rsi > 45 && s.rsi < 75;
  if (!rsiBullTrend) return null;

  // Pullback to EMA (tight for 1H)
  const pullbackBull =
    s.currentLow <= s.emaFast * 1.003 || s.currentLow <= s.emaMid * 1.003;
  if (!pullbackBull) return null;

  // Trend candle confirmation
  const trendBullCandle =
    s.currentClose > s.currentOpen && s.currentClose > s.emaFast;
  if (!trendBullCandle) return null;

  // VWAP confirming
  if (STRATEGY.USE_VWAP && s.currentClose <= s.vwap) return null;

  // 4H MTF confirming
  if (s.eth4hEmaFast <= s.eth4hEmaMid) return null;

  // BTC filter
  if (STRATEGY.USE_BTC_FILTER) {
    const btcChg =
      s.btcPrev4h > 0
        ? ((s.btcClose4h - s.btcPrev4h) / s.btcPrev4h) * 100
        : 0;
    if (btcChg <= -STRATEGY.BTC_DROP_PCT) return null;
  }

  // Volume filter
  if (STRATEGY.USE_VOL_FILTER && s.currentVolume < s.volumeMa * STRATEGY.VOL_MULT)
    return null;

  // HQ: DI+ > DI- and ADX > 30
  const isHQ = s.diPlus > s.diMinus && s.adx > 30;

  return {
    side: 'long',
    mode: 'trend',
    isHighQuality: isHQ,
  };
}

function checkTrendShort(s: IndicatorSnapshot): Signal | null {
  // EMA ribbon bearish
  const ribbonBear =
    s.emaFast < s.emaMid && s.emaMid < s.emaSlow && s.currentClose < s.emaFast;
  if (!ribbonBear) return null;

  // MACD trend confirming
  const macdBearTrend =
    s.macdLine < s.macdSignal && s.macdHist < 0;
  if (!macdBearTrend) return null;

  // RSI in favorable zone
  const rsiBearTrend = s.rsi < 55 && s.rsi > 25;
  if (!rsiBearTrend) return null;

  // Pullback to EMA
  const pullbackBear =
    s.currentHigh >= s.emaFast * 0.997 || s.currentHigh >= s.emaMid * 0.997;
  if (!pullbackBear) return null;

  // Trend candle confirmation
  const trendBearCandle =
    s.currentClose < s.currentOpen && s.currentClose < s.emaFast;
  if (!trendBearCandle) return null;

  // VWAP confirming
  if (STRATEGY.USE_VWAP && s.currentClose >= s.vwap) return null;

  // 4H MTF confirming
  if (s.eth4hEmaFast >= s.eth4hEmaMid) return null;

  // BTC filter
  if (STRATEGY.USE_BTC_FILTER) {
    const btcChg =
      s.btcPrev4h > 0
        ? ((s.btcClose4h - s.btcPrev4h) / s.btcPrev4h) * 100
        : 0;
    if (btcChg >= STRATEGY.BTC_DROP_PCT) return null;
  }

  // Volume filter
  if (STRATEGY.USE_VOL_FILTER && s.currentVolume < s.volumeMa * STRATEGY.VOL_MULT)
    return null;

  // HQ: DI- > DI+ and ADX > 30
  const isHQ = s.diMinus > s.diPlus && s.adx > 30;

  return {
    side: 'short',
    mode: 'trend',
    isHighQuality: isHQ,
  };
}
