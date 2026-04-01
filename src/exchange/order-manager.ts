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
  stopLossPrice?: number
): Promise<OrderResult | null> {
  const vol = roundDown(volume, 8);

  if (vol < KRAKEN.MIN_ORDER_ETH) {
    logger.warn(`Order volume ${vol} below minimum ${KRAKEN.MIN_ORDER_ETH}, skipping`);
    return null;
  }

  try {
    const params: Parameters<typeof rest.addOrder>[0] = {
      pair: KRAKEN.ETH_PAIR,
      type: side,
      ordertype: 'market',
      volume: vol.toString(),
    };

    if (stopLossPrice) {
      params.close_ordertype = 'stop-loss';
      params.close_price = roundDown(stopLossPrice, 2).toString();
    }

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
