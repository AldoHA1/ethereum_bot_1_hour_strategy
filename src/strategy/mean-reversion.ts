import { STRATEGY } from '../config';
import { IndicatorSnapshot, Signal } from './types';

/**
 * Mean Reversion entry conditions (ADX < 30)
 * Matching PineScript logic exactly
 */
export function checkMeanReversion(s: IndicatorSnapshot): Signal | null {
  // ADX must be in range mode
  if (STRATEGY.USE_ADX_FILTER && s.adx >= STRATEGY.ADX_MAX_MR) {
    return null;
  }

  const longSignal = checkMRLong(s);
  if (longSignal) return longSignal;

  const shortSignal = checkMRShort(s);
  if (shortSignal) return shortSignal;

  return null;
}

function checkMRLong(s: IndicatorSnapshot): Signal | null {
  // RSI oversold with 3-candle window + recovery
  const rsiOversold =
    s.rsi < STRATEGY.RSI_OVERSOLD ||
    s.rsiPrev1 < STRATEGY.RSI_OVERSOLD ||
    s.rsiPrev2 < STRATEGY.RSI_OVERSOLD;
  const rsiRecoveringUp =
    s.rsi > s.rsiPrev1 || s.rsi > STRATEGY.RSI_OVERSOLD;
  const rsiLong = rsiOversold && rsiRecoveringUp;
  if (!rsiLong) return null;

  // Stochastic in bull zone with cross or direction
  const stochBullZone = s.stochK < 40;
  const stochBullCross =
    (s.stochK > s.stochD && s.stochKPrev1 <= s.stochDPrev1) ||
    (s.stochKPrev1 > s.stochDPrev1 && s.stochKPrev2 <= s.stochDPrev2);
  const stochBullCrossRecent =
    stochBullCross ||
    (s.stochK > s.stochD && s.stochKPrev1 <= s.stochDPrev1);
  const stochBullDir = s.stochK > s.stochD;
  const stochLong = stochBullZone && (stochBullCrossRecent || stochBullDir);
  if (!stochLong) return null;

  // Candle confirmation
  if (STRATEGY.USE_CANDLE_CONF && s.currentClose <= s.currentOpen) return null;

  // Trend filter (flexible for MR)
  const trendLong =
    s.currentClose > s.emaSlow ||
    (s.currentClose > s.emaSlow * 0.99 && s.currentClose > s.prevClose) ||
    s.emaFast > s.emaFastPrev1;
  if (!trendLong) return null;

  // VWAP filter
  if (STRATEGY.USE_VWAP && s.currentClose <= s.vwap) return null;

  // Volume filter
  if (STRATEGY.USE_VOL_FILTER && s.currentVolume < s.volumeMa * STRATEGY.VOL_MULT)
    return null;

  // BTC filter
  if (STRATEGY.USE_BTC_FILTER) {
    const btcChg =
      s.btcPrev4h > 0
        ? ((s.btcClose4h - s.btcPrev4h) / s.btcPrev4h) * 100
        : 0;
    if (btcChg <= -STRATEGY.BTC_DROP_PCT) return null;
  }

  // Full signal (HQ) includes EMA200, MACD
  const macroLong = !STRATEGY.USE_EMA200 || s.currentClose > s.ema200;
  const macdLong = s.macdHist > s.macdHistPrev1;

  const isHQ = macroLong && macdLong;

  // Core signal passes if we get here (VWAP, ADX, vol, BTC all checked)
  return {
    side: 'long',
    mode: 'mean_reversion',
    isHighQuality: isHQ,
  };
}

function checkMRShort(s: IndicatorSnapshot): Signal | null {
  // RSI overbought with 3-candle window + recovery
  const rsiOverbought =
    s.rsi > STRATEGY.RSI_OVERBOUGHT ||
    s.rsiPrev1 > STRATEGY.RSI_OVERBOUGHT ||
    s.rsiPrev2 > STRATEGY.RSI_OVERBOUGHT;
  const rsiRecoveringDn =
    s.rsi < s.rsiPrev1 || s.rsi < STRATEGY.RSI_OVERBOUGHT;
  const rsiShort = rsiOverbought && rsiRecoveringDn;
  if (!rsiShort) return null;

  // Stochastic in bear zone
  const stochBearZone = s.stochK > 60;
  const stochBearCross =
    (s.stochK < s.stochD && s.stochKPrev1 >= s.stochDPrev1) ||
    (s.stochKPrev1 < s.stochDPrev1 && s.stochKPrev2 >= s.stochDPrev2);
  const stochBearDir = s.stochK < s.stochD;
  const stochShort = stochBearZone && (stochBearCross || stochBearDir);
  if (!stochShort) return null;

  // Candle confirmation (bearish)
  if (STRATEGY.USE_CANDLE_CONF && s.currentClose >= s.currentOpen) return null;

  // Trend filter (flexible for MR short)
  const trendShort =
    s.currentClose < s.emaSlow ||
    (s.currentClose < s.emaSlow * 1.01 && s.currentClose < s.prevClose) ||
    s.emaFast < s.emaFastPrev1;
  if (!trendShort) return null;

  // VWAP filter (shorts below VWAP)
  if (STRATEGY.USE_VWAP && s.currentClose >= s.vwap) return null;

  // Volume filter
  if (STRATEGY.USE_VOL_FILTER && s.currentVolume < s.volumeMa * STRATEGY.VOL_MULT)
    return null;

  // BTC filter (BTC rallying blocks shorts)
  if (STRATEGY.USE_BTC_FILTER) {
    const btcChg =
      s.btcPrev4h > 0
        ? ((s.btcClose4h - s.btcPrev4h) / s.btcPrev4h) * 100
        : 0;
    if (btcChg >= STRATEGY.BTC_DROP_PCT) return null;
  }

  const macroShort = !STRATEGY.USE_EMA200 || s.currentClose < s.ema200;
  const macdShort = s.macdHist < s.macdHistPrev1;
  const isHQ = macroShort && macdShort;

  return {
    side: 'short',
    mode: 'mean_reversion',
    isHighQuality: isHQ,
  };
}
