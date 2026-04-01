import { STRATEGY, KRAKEN } from '../config';
import { logger } from '../utils/logger';

export function calculatePositionSize(params: {
  equity: number;
  isHighQuality: boolean;
  isHotStreak: boolean;
  atr: number;
  entryPrice: number;
}): number {
  const { equity, isHighQuality, isHotStreak, atr, entryPrice } = params;

  // Risk percentage
  let riskPct = isHighQuality
    ? STRATEGY.RISK_PCT_HQ / 100
    : STRATEGY.RISK_PCT_BASE / 100;

  if (isHotStreak) {
    riskPct *= STRATEGY.HOT_STREAK_MULT;
  }

  const riskAmount = equity * riskPct;

  // SL distance in price
  const slDistance = atr * STRATEGY.SL_ATR_MULT;

  // Include round-trip fees in risk calculation
  const feePerSide = entryPrice * KRAKEN.TAKER_FEE;
  const totalFees = feePerSide * 2;

  // Effective SL distance including fees
  const effectiveSL = slDistance + totalFees;

  if (effectiveSL <= 0) {
    logger.warn('SL distance <= 0, cannot size position');
    return 0;
  }

  let qty = riskAmount / effectiveSL;

  // Clamp to minimum
  if (qty < KRAKEN.MIN_ORDER_ETH) {
    logger.warn(
      `Calculated qty ${qty.toFixed(6)} below min ${KRAKEN.MIN_ORDER_ETH}, adjusting`
    );
    qty = KRAKEN.MIN_ORDER_ETH;
  }

  logger.info(
    `Position size: equity=$${equity.toFixed(2)}, risk=${(riskPct * 100).toFixed(1)}%, ` +
      `SL=${slDistance.toFixed(2)}, fees=${totalFees.toFixed(2)}, qty=${qty.toFixed(6)} ETH`
  );

  return qty;
}
