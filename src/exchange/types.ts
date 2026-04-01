export interface KrakenOHLC {
  time: number;
  open: string;
  high: string;
  low: string;
  close: string;
  vwap: string;
  volume: string;
  count: number;
}

export interface KrakenBalance {
  [asset: string]: string;
}

export interface KrakenTradeBalance {
  eb: string; // equivalent balance
  tb: string; // trade balance
  m: string;  // margin
  n: string;  // unrealized P&L
  e: string;  // equity = tb + n
  mf: string; // free margin
}

export interface KrakenOrder {
  txid?: string[];
  descr?: { order: string };
  status?: string;
  opentm?: number;
  closetm?: number;
  vol?: string;
  vol_exec?: string;
  cost?: string;
  fee?: string;
  price?: string;
  misc?: string;
}

export interface KrakenAddOrderResult {
  txid: string[];
  descr: { order: string };
}

export interface KrakenResponse<T> {
  error: string[];
  result: T;
}

export interface WsOhlcMessage {
  channel: string;
  type: string;
  data: Array<{
    symbol: string;
    open: string;
    high: string;
    low: string;
    close: string;
    vwap: string;
    volume: string;
    trades: number;
    interval_begin: string;
    interval: number;
    timestamp: string;
  }>;
}

export interface WsExecutionMessage {
  channel: string;
  type: string;
  data: Array<{
    exec_type: string;
    order_id: string;
    order_status: string;
    side: string;
    symbol: string;
    avg_price: string;
    cum_qty: string;
    fee_paid: string;
    order_type: string;
    timestamp: string;
  }>;
}
