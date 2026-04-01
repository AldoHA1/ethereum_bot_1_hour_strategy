import { STRATEGY } from '../config';
import { CandleStore } from '../data/candle-store';
import {
  computeRSI,
  computeStochastic,
  computeEMA,
  computeVWAP,
  computeADX,
  computeMACD,
  computeATR,
  computeSMA,
} from '../indicators';
import { IndicatorSnapshot, Signal } from './types';
import { checkMeanReversion } from './mean-reversion';
import { checkTrend } from './trend-mode';
import { computeMTF } from './mtf-analyzer';
import { logger } from '../utils/logger';

export function buildSnapshot(
  ethStore1h: CandleStore,
  ethStore4h: CandleStore,
  btcStore4h: CandleStore
): IndicatorSnapshot | null {
  const candles = ethStore1h.getAll();
  if (candles.length < STRATEGY.EMA_MACRO + 10) {
    logger.debug(
      `Not enough candles for snapshot: ${candles.length}/${STRATEGY.EMA_MACRO + 10}`
    );
    return null;
  }

  const closes = ethStore1h.closes();
  const highs = ethStore1h.highs();
  const lows = ethStore1h.lows();
  const opens = ethStore1h.opens();
  const volumes = ethStore1h.volumes();
  const len = closes.length;

  const last = (arr: number[]) => arr[len - 1];
  const prev = (arr: number[], off: number) =>
    len - 1 - off >= 0 ? arr[len - 1 - off] : NaN;

  // RSI
  const rsi = computeRSI(closes, STRATEGY.RSI_PERIOD);

  // Stochastic
  const stoch = computeStochastic(
    closes,
    highs,
    lows,
    STRATEGY.STOCH_K,
    STRATEGY.STOCH_SMOOTH,
    STRATEGY.STOCH_D
  );

  // EMAs
  const emaFast = computeEMA(closes, STRATEGY.EMA_FAST);
  const emaMid = computeEMA(closes, STRATEGY.EMA_MID);
  const emaSlow = computeEMA(closes, STRATEGY.EMA_SLOW);
  const ema200 = computeEMA(closes, STRATEGY.EMA_MACRO);

  // VWAP
  const vwap = computeVWAP(candles);

  // ADX
  const adx = computeADX(highs, lows, closes, STRATEGY.ADX_PERIOD);

  // MACD
  const macd = computeMACD(
    closes,
    STRATEGY.MACD_FAST,
    STRATEGY.MACD_SLOW,
    STRATEGY.MACD_SIGNAL
  );

  // ATR
  const atr14 = computeATR(highs, lows, closes, STRATEGY.ATR_PERIOD);
  const atr3 = computeATR(highs, lows, closes, STRATEGY.ATR_FAST);

  // Volume MA
  const volMa = computeSMA(volumes, STRATEGY.VOL_MA_LEN);

  // MTF
  const mtf = computeMTF(ethStore4h, btcStore4h);

  const snapshot: IndicatorSnapshot = {
    rsi: last(rsi),
    rsiPrev1: prev(rsi, 1),
    rsiPrev2: prev(rsi, 2),

    stochK: last(stoch.k),
    stochD: last(stoch.d),
    stochKPrev1: prev(stoch.k, 1),
    stochDPrev1: prev(stoch.d, 1),
    stochKPrev2: prev(stoch.k, 2),
    stochDPrev2: prev(stoch.d, 2),

    emaFast: last(emaFast),
    emaMid: last(emaMid),
    emaSlow: last(emaSlow),
    ema200: last(ema200),
    emaFastPrev1: prev(emaFast, 1),
    emaFastPrev2: prev(emaFast, 2),
    emaMidPrev1: prev(emaMid, 1),
    emaMidPrev3: prev(emaMid, 3),

    vwap: last(vwap),

    adx: last(adx.adx),
    diPlus: last(adx.diPlus),
    diMinus: last(adx.diMinus),

    macdLine: last(macd.macd),
    macdSignal: last(macd.signal),
    macdHist: last(macd.histogram),
    macdHistPrev1: prev(macd.histogram, 1),

    atr14: last(atr14),
    atr3: last(atr3),

    volumeMa: last(volMa),
    currentVolume: volumes[len - 1],
    currentClose: closes[len - 1],
    currentOpen: opens[len - 1],
    currentHigh: highs[len - 1],
    currentLow: lows[len - 1],
    prevClose: prev(closes, 1),

    eth4hEmaFast: mtf.eth4hEmaFast,
    eth4hEmaMid: mtf.eth4hEmaMid,
    eth4hRsi: mtf.eth4hRsi,

    btcClose4h: mtf.btcClose4h,
    btcPrev4h: mtf.btcPrev4h,
    btcEma4h: mtf.btcEma4h,
  };

  return snapshot;
}

export function evaluateSignal(snapshot: IndicatorSnapshot): Signal | null {
  // Check both modes - MR takes priority (checked first in PineScript)
  const mrSignal = checkMeanReversion(snapshot);
  if (mrSignal) return mrSignal;

  const trendSignal = checkTrend(snapshot);
  if (trendSignal) return trendSignal;

  return null;
}

export function logSnapshot(snapshot: IndicatorSnapshot): void {
  logger.debug(
    `Indicators: RSI=${snapshot.rsi?.toFixed(1)} Stoch=%K=${snapshot.stochK?.toFixed(1)}/%D=${snapshot.stochD?.toFixed(1)} ` +
      `ADX=${snapshot.adx?.toFixed(1)} MACD_H=${snapshot.macdHist?.toFixed(4)} ` +
      `ATR14=${snapshot.atr14?.toFixed(2)} ATR3=${snapshot.atr3?.toFixed(2)} ` +
      `EMA9=${snapshot.emaFast?.toFixed(2)} EMA21=${snapshot.emaMid?.toFixed(2)} ` +
      `EMA50=${snapshot.emaSlow?.toFixed(2)} EMA200=${snapshot.ema200?.toFixed(2)} ` +
      `VWAP=${snapshot.vwap?.toFixed(2)} Close=${snapshot.currentClose?.toFixed(2)} ` +
      `4H_EMA9=${snapshot.eth4hEmaFast?.toFixed(2)} 4H_EMA21=${snapshot.eth4hEmaMid?.toFixed(2)} ` +
      `BTC4H=${snapshot.btcClose4h?.toFixed(2)}`
  );
}
