import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { KRAKEN } from '../config';
import { logger } from '../utils/logger';

export interface WsCandle {
  symbol: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  vwap: number;
  trades: number;
  intervalBegin: number;
  timestamp: number;
}

export class KrakenWsClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectDelay: number;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private reconnecting = false;
  private subscriptions: Array<{ channel: string; params: Record<string, unknown> }> = [];
  private token: string | null = null;
  private isPrivate: boolean;

  constructor(url: string, isPrivate = false) {
    super();
    this.url = url;
    this.isPrivate = isPrivate;
    this.reconnectDelay = KRAKEN.WS_RECONNECT_MIN_MS;
  }

  setToken(token: string): void {
    this.token = token;
  }

  connect(): void {
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.close();
    }

    logger.info(`WS connecting to ${this.url}...`);
    this.ws = new WebSocket(this.url);

    this.ws.on('open', () => {
      logger.info('WS connected');
      this.reconnectDelay = KRAKEN.WS_RECONNECT_MIN_MS;
      this.reconnecting = false;
      this.startHeartbeat();
      this.resubscribe();
      this.emit('connected');
    });

    this.ws.on('message', (data: Buffer) => {
      this.resetHeartbeat();
      try {
        const msg = JSON.parse(data.toString());
        this.handleMessage(msg);
      } catch (err) {
        logger.error(`WS parse error: ${err}`);
      }
    });

    this.ws.on('close', (code, reason) => {
      logger.warn(`WS closed: ${code} ${reason.toString()}`);
      this.stopHeartbeat();
      this.scheduleReconnect();
    });

    this.ws.on('error', (err) => {
      logger.error(`WS error: ${err.message}`);
    });
  }

  private handleMessage(msg: unknown): void {
    const m = msg as Record<string, unknown>;

    if (m.method === 'pong') return;

    if (m.channel === 'heartbeat') return;

    if (m.channel === 'status') {
      logger.debug(`WS status: ${JSON.stringify(m)}`);
      return;
    }

    if (m.channel === 'ohlc' && m.type === 'update') {
      const data = m.data as Array<Record<string, unknown>>;
      if (data && data.length > 0) {
        const d = data[0];
        const candle: WsCandle = {
          symbol: d.symbol as string,
          open: parseFloat(d.open as string),
          high: parseFloat(d.high as string),
          low: parseFloat(d.low as string),
          close: parseFloat(d.close as string),
          volume: parseFloat(d.volume as string),
          vwap: parseFloat(d.vwap as string),
          trades: d.trades as number,
          intervalBegin: new Date(d.interval_begin as string).getTime(),
          timestamp: new Date(d.timestamp as string).getTime(),
        };
        this.emit('ohlc', candle);
      }
      return;
    }

    if (m.channel === 'ohlc' && m.type === 'snapshot') {
      const data = m.data as Array<Record<string, unknown>>;
      if (data) {
        for (const d of data) {
          const candle: WsCandle = {
            symbol: d.symbol as string,
            open: parseFloat(d.open as string),
            high: parseFloat(d.high as string),
            low: parseFloat(d.low as string),
            close: parseFloat(d.close as string),
            volume: parseFloat(d.volume as string),
            vwap: parseFloat(d.vwap as string),
            trades: d.trades as number,
            intervalBegin: new Date(d.interval_begin as string).getTime(),
            timestamp: new Date(d.timestamp as string).getTime(),
          };
          this.emit('ohlc_snapshot', candle);
        }
      }
      return;
    }

    if (m.channel === 'executions') {
      this.emit('executions', m.data);
      return;
    }

    if (m.method === 'subscribe' && m.success === false) {
      logger.error(`WS subscribe failed: ${JSON.stringify(m)}`);
    }
  }

  subscribe(channel: string, params: Record<string, unknown>): void {
    const sub = { channel, params };
    this.subscriptions.push(sub);
    this.sendSubscription(sub);
  }

  private sendSubscription(sub: { channel: string; params: Record<string, unknown> }): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const msg: Record<string, unknown> = {
      method: 'subscribe',
      params: {
        channel: sub.channel,
        ...sub.params,
      },
    };

    if (this.isPrivate && this.token) {
      (msg.params as Record<string, unknown>).token = this.token;
    }

    this.ws.send(JSON.stringify(msg));
    logger.debug(`WS subscribed to ${sub.channel}: ${JSON.stringify(sub.params)}`);
  }

  private resubscribe(): void {
    for (const sub of this.subscriptions) {
      this.sendSubscription(sub);
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ method: 'ping' }));
      }
    }, 15000);
  }

  private resetHeartbeat(): void {
    // Any message received resets the timeout
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnecting) return;
    this.reconnecting = true;

    logger.info(`WS reconnecting in ${this.reconnectDelay}ms...`);
    setTimeout(() => {
      this.reconnectDelay = Math.min(
        this.reconnectDelay * 2,
        KRAKEN.WS_RECONNECT_MAX_MS
      );
      this.connect();
    }, this.reconnectDelay);
  }

  close(): void {
    this.stopHeartbeat();
    this.reconnecting = true; // prevent reconnect
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  get isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}
