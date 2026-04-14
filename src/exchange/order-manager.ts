import { KRAKEN } from '../config';
import * as rest from './rest-client';
import { logger } from '../utils/logger';
import { roundDown } from '../utils/math';

export interface OrderResult {
  txid: string;
  description: string;
}

export async function placeMarketOrder(
  side: 'buy' | 'sell',
  volume: number,
): Promise<OrderResult | null> {
  let vol = roundDown(volume, 8);

  if (vol < KRAKEN.MIN_ORDER_ETH) {
    logger.warn(`Order volume ${vol} below minimum ${KRAKEN.MIN_ORDER_ETH}, skipping`);
    return null;
  }

  // For sell orders, verify we actually hold enough *available* ETH
  if (side === 'sell') {
    try {
      const balances = await rest.getBalance();
      const totalEth = parseFloat(balances['XETH'] || balances['ETH'] || '0');

      // Subtract ETH reserved by open sell orders (stop-losses, limits, etc.)
      let reservedEth = 0;
      try {
        const openOrders = await rest.getOpenOrders();
        for (const [, order] of Object.entries(openOrders.open || {})) {
          if (order.descr?.type === 'sell' || (order.descr?.order || '').toLowerCase().startsWith('sell')) {
            const orderVol = parseFloat(order.vol || '0');
            const execVol = parseFloat(order.vol_exec || '0');
            reservedEth += orderVol - execVol;
          }
        }
      } catch (e) {
        logger.warn(`Could not check open orders for reserved ETH: ${e}`);
      }

      const ethBalance = totalEth - reservedEth;
      logger.debug(`ETH balance: total=${totalEth.toFixed(8)} reserved=${reservedEth.toFixed(8)} available=${ethBalance.toFixed(8)}`);

      if (ethBalance < KRAKEN.MIN_ORDER_ETH) {
        logger.warn(`Sell skipped: available ETH ${ethBalance.toFixed(8)} below minimum (total=${totalEth.toFixed(8)}, reserved=${reservedEth.toFixed(8)})`);
        return null;
      }
      if (vol > ethBalance) {
        logger.warn(`Capping sell volume from ${vol} to ${ethBalance.toFixed(8)} (available ETH)`);
        vol = roundDown(ethBalance, 8);
        if (vol < KRAKEN.MIN_ORDER_ETH) {
          logger.warn(`Capped sell volume ${vol} below minimum, skipping`);
          return null;
        }
      }
    } catch (err) {
      logger.warn(`Failed to check ETH balance before sell: ${err}`);
    }
  }

  try {
    const params: Parameters<typeof rest.addOrder>[0] = {
      pair: KRAKEN.ETH_PAIR,
      type: side,
      ordertype: 'market',
      volume: vol.toString(),
    };

    const result = await rest.addOrder(params);
    const txid = result.txid[0];
    logger.info(`Order placed: ${side} ${vol} ETH/USD → ${txid} (${result.descr.order})`);

    return { txid, description: result.descr.order };
  } catch (err) {
    logger.error(`Failed to place ${side} order: ${err}`);
    return null;
  }
}

export async function placeStopLoss(
  side: 'buy' | 'sell',
  volume: number,
  stopPrice: number
): Promise<OrderResult | null> {
  const vol = roundDown(volume, 8);

  if (vol < KRAKEN.MIN_ORDER_ETH) {
    logger.warn(`SL volume ${vol} below minimum, skipping`);
    return null;
  }

  try {
    const result = await rest.addOrder({
      pair: KRAKEN.ETH_PAIR,
      type: side,
      ordertype: 'stop-loss',
      volume: vol.toString(),
      price: roundDown(stopPrice, 2).toString(),
    });

    const txid = result.txid[0];
    logger.info(`Stop-loss placed: ${side} ${vol} @ ${stopPrice} → ${txid}`);
    return { txid, description: result.descr.order };
  } catch (err) {
    logger.error(`Failed to place SL: ${err}`);
    return null;
  }
}

export async function cancelOrderById(txid: string): Promise<boolean> {
  try {
    await rest.cancelOrder(txid);
    logger.info(`Order cancelled: ${txid}`);
    return true;
  } catch (err) {
    logger.error(`Failed to cancel order ${txid}: ${err}`);
    return false;
  }
}

/**
 * Cancel any open stop-loss sell orders that are reserving ETH.
 * Uses structured descr fields from Kraken (pair may be XETHZUSD, not ETHUSD).
 */
export async function cancelOpenStopLosses(pair: string): Promise<void> {
  try {
    const result = await rest.getOpenOrders();
    for (const [txid, order] of Object.entries(result.open || {})) {
      const descr = order.descr;
      if (!descr) continue;

      const isStopLoss = descr.ordertype === 'stop-loss' ||
        (descr.order || '').toLowerCase().includes('stop');
      const matchesPair = descr.pair?.includes('ETH') ||
        (descr.order || '').includes('ETH');

      if (isStopLoss && matchesPair) {
        logger.info(`Cancelling stop-loss order ${txid}: ${descr.order}`);
        await cancelOrderById(txid);
      }
    }
  } catch (err) {
    logger.warn(`Failed to cancel open stop-losses: ${err}`);
  }
}

export async function getOpenOrdersList(): Promise<
  Array<{ txid: string; status: string; type: string; volume: string; price: string }>
> {
  try {
    const result = await rest.getOpenOrders();
    const orders: Array<{
      txid: string;
      status: string;
      type: string;
      volume: string;
      price: string;
    }> = [];

    for (const [txid, order] of Object.entries(result.open || {})) {
      orders.push({
        txid,
        status: order.status || 'unknown',
        type: order.descr?.order || 'unknown',
        volume: order.vol || '0',
        price: order.price || '0',
      });
    }
    return orders;
  } catch (err) {
    logger.error(`Failed to get open orders: ${err}`);
    return [];
  }
}
