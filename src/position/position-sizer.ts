import { STRATEGY, KRAKEN } from '../config';
import { logger } from '../utils/logger';

export function calculatePositionSize(params: {
  equity: number;
  availableBalance: number;
  isHotStreak: boolean;
  atr: number;
  entryPrice: number;
}): number {
  const { equity, availableBalance, isHotStreak, atr, entryPrice } = params;

  // Risk percentage
  let riskPct = STRATEGY.RISK_PCT / 100;

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

  // Cap to 20% of available balance per trade (with slight buffer for slippage/fee rounding)
  const maxSpend = availableBalance * 0.20 * 0.98;
  const maxAffordableQty = maxSpend / (entryPrice * (1 + KRAKEN.TAKER_FEE));
  if (qty > maxAffordableQty) {
    logger.warn(
      `Capping qty from ${qty.toFixed(6)} to ${maxAffordableQty.toFixed(6)} (available balance: $${availableBalance.toFixed(2)})`
    );
    qty = maxAffordableQty;
  }

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
