export const KRAKEN = {
  REST_URL: "https://api.kraken.com",
  WS_PUBLIC_URL: "wss://ws.kraken.com/v2",
  WS_PRIVATE_URL: "wss://ws-auth.kraken.com/v2",

  // Trading pair
  ETH_PAIR: "ETHUSD",
  ETH_WS_PAIR: "ETH/USD",

  // Candle interval in minutes
  INTERVAL_5M: 5,

  // Min order sizes
  MIN_ORDER_ETH: 0.01,

  // Fee tiers (Starter)
  TAKER_FEE: 0.0026,
  MAKER_FEE: 0.0016,

  // Rate limiting
  MAX_API_CALLS_PER_SEC: 1,
  ORDER_RATE_LIMIT: 60,

  // Backfill
  BACKFILL_CANDLES: 720,

  // Reconnection
  WS_RECONNECT_MIN_MS: 1000,
  WS_RECONNECT_MAX_MS: 60000,
  WS_HEARTBEAT_TIMEOUT_MS: 30000,
} as const;
