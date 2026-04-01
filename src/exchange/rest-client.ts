import { ENV, KRAKEN } from '../config';
import { createNonce, signRequest } from './auth';
import { KrakenResponse } from './types';
import { logger } from '../utils/logger';

const API_URL = KRAKEN.REST_URL;

let lastCallTime = 0;
const MIN_INTERVAL_MS = 1000 / KRAKEN.MAX_API_CALLS_PER_SEC;

async function throttle(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastCallTime;
  if (elapsed < MIN_INTERVAL_MS) {
    await new Promise((r) => setTimeout(r, MIN_INTERVAL_MS - elapsed));
  }
  lastCallTime = Date.now();
}

async function retryFetch(
  url: string,
  options: RequestInit,
  retries = 3
): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      await throttle();
      const res = await fetch(url, options);
      if (res.status >= 500 && i < retries - 1) {
        const wait = Math.pow(2, i) * 1000;
        logger.warn(`HTTP ${res.status}, retrying in ${wait}ms...`);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      return res;
    } catch (err) {
      if (i === retries - 1) throw err;
      const wait = Math.pow(2, i) * 1000;
      logger.warn(`Fetch error, retrying in ${wait}ms: ${err}`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw new Error('Retry exhausted');
}

export async function publicGet<T>(
  endpoint: string,
  params: Record<string, string> = {}
): Promise<T> {
  const qs = new URLSearchParams(params).toString();
  const url = `${API_URL}${endpoint}${qs ? '?' + qs : ''}`;

  logger.debug(`GET ${url}`);
  const res = await retryFetch(url, { method: 'GET' });
  const json = (await res.json()) as KrakenResponse<T>;

  if (json.error && json.error.length > 0) {
    throw new Error(`Kraken API error: ${json.error.join(', ')}`);
  }
  return json.result;
}

export async function privatePost<T>(
  endpoint: string,
  data: Record<string, string> = {}
): Promise<T> {
  const nonce = createNonce();
  const postData = new URLSearchParams({ nonce, ...data }).toString();
  const signature = signRequest(endpoint, nonce, postData, ENV.secretKey);

  const url = `${API_URL}${endpoint}`;
  logger.debug(`POST ${endpoint}`);

  const res = await retryFetch(url, {
    method: 'POST',
    headers: {
      'API-Key': ENV.apiKey,
      'API-Sign': signature,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: postData,
  });

  const json = (await res.json()) as KrakenResponse<T>;

  if (json.error && json.error.length > 0) {
    throw new Error(`Kraken API error: ${json.error.join(', ')}`);
  }
  return json.result;
}

export async function getBalance(): Promise<Record<string, string>> {
  return privatePost<Record<string, string>>('/0/private/Balance');
}

export async function getTradeBalance(): Promise<{
  eb: string;
  tb: string;
  e: string;
  mf: string;
  n: string;
}> {
  return privatePost('/0/private/TradeBalance', { asset: 'ZUSD' });
}

export async function getOHLC(
  pair: string,
  interval: number,
  since?: number
): Promise<Record<string, unknown>> {
  const params: Record<string, string> = {
    pair,
    interval: interval.toString(),
  };
  if (since) params.since = since.toString();
  return publicGet('/0/public/OHLC', params);
}

export async function addOrder(params: {
  pair: string;
  type: 'buy' | 'sell';
  ordertype: 'market' | 'limit' | 'stop-loss' | 'stop-loss-limit';
  volume: string;
  price?: string;
  close_ordertype?: string;
  close_price?: string;
  validate?: boolean;
}): Promise<{ txid: string[]; descr: { order: string } }> {
  const data: Record<string, string> = {
    pair: params.pair,
    type: params.type,
    ordertype: params.ordertype,
    volume: params.volume,
  };
  if (params.price) data.price = params.price;
  if (params.close_ordertype) {
    data['close[ordertype]'] = params.close_ordertype;
    if (params.close_price) data['close[price]'] = params.close_price;
  }
  if (params.validate) data.validate = 'true';

  if (ENV.dryRun) {
    data.validate = 'true';
    logger.info(`[DRY RUN] Order: ${JSON.stringify(data)}`);
  }

  return privatePost('/0/private/AddOrder', data);
}

export async function cancelOrder(txid: string): Promise<{ count: number }> {
  return privatePost('/0/private/CancelOrder', { txid });
}

export async function getOpenOrders(): Promise<{
  open: Record<string, KrakenOrder>;
}> {
  return privatePost('/0/private/OpenOrders');
}

export async function getWebSocketsToken(): Promise<{ token: string }> {
  return privatePost('/0/private/GetWebSocketsToken');
}

import { KrakenOrder } from './types';
