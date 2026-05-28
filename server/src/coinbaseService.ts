import WebSocket from 'ws';
import { EventEmitter } from 'events';
import {
  CoinbaseInboundMessage,
  CoinbaseSnapshotMessage,
  CoinbaseL2UpdateMessage,
  CoinbaseMatchMessage,
  CoinbaseSubscriptionsMessage,
  CoinbaseSubscribeRequest,
} from './types';

// Typed event emitter interface so callers get type-checked listener signatures.
export interface CoinbaseServiceEvents {
  connected: () => void;
  disconnected: () => void;
  snapshot: (msg: CoinbaseSnapshotMessage) => void;
  l2update: (msg: CoinbaseL2UpdateMessage) => void;
  match: (msg: CoinbaseMatchMessage) => void;
  subscriptions: (msg: CoinbaseSubscriptionsMessage) => void;
  error: (err: Error) => void;
}

declare interface CoinbaseService {
  on<K extends keyof CoinbaseServiceEvents>(event: K, listener: CoinbaseServiceEvents[K]): this;
  emit<K extends keyof CoinbaseServiceEvents>(
    event: K,
    ...args: Parameters<CoinbaseServiceEvents[K]>
  ): boolean;
}

/**
 * Manages a single long-lived WebSocket connection to the Coinbase Exchange
 * public feed.  Reconnects automatically on unexpected disconnection.
 *
 * All Coinbase message types are re-emitted as typed events so consumers
 * do not need to know about raw WebSocket framing.
 */
class CoinbaseService extends EventEmitter {
  private ws: WebSocket | null = null;
  private readonly wsUrl: string;
  private readonly reconnectDelayMs: number;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionallyClosed = false;

  constructor(wsUrl: string, reconnectDelayMs = 5000) {
    super();
    this.wsUrl = wsUrl;
    this.reconnectDelayMs = reconnectDelayMs;
  }

  connect(): void {
    this.intentionallyClosed = false;
    this.openSocket();
  }

  private openSocket(): void {
    this.ws = new WebSocket(this.wsUrl);

    this.ws.on('open', () => {
      this.emit('connected');
    });

    this.ws.on('message', (raw: WebSocket.RawData) => {
      try {
        const msg = JSON.parse(raw.toString()) as CoinbaseInboundMessage;
        this.handleMessage(msg);
      } catch (err) {
        this.emit('error', new Error(`Failed to parse Coinbase message: ${String(err)}`));
      }
    });

    this.ws.on('error', (err: Error) => {
      this.emit('error', err);
    });

    this.ws.on('close', () => {
      this.emit('disconnected');
      if (!this.intentionallyClosed) {
        this.reconnectTimer = setTimeout(() => this.openSocket(), this.reconnectDelayMs);
      }
    });
  }

  private handleMessage(msg: CoinbaseInboundMessage): void {
    switch (msg.type) {
      case 'snapshot':
        this.emit('snapshot', msg as CoinbaseSnapshotMessage);
        break;
      case 'l2update':
        this.emit('l2update', msg as CoinbaseL2UpdateMessage);
        break;
      case 'match':
      case 'last_match':
        this.emit('match', msg as CoinbaseMatchMessage);
        break;
      case 'subscriptions':
        this.emit('subscriptions', msg as CoinbaseSubscriptionsMessage);
        break;
      case 'error':
        this.emit('error', new Error(`Coinbase error: ${msg.message}`));
        break;
    }
  }

  subscribe(productIds: string[], channels: string[]): void {
    this.send({ type: 'subscribe', product_ids: productIds, channels });
  }

  unsubscribe(productIds: string[], channels: string[]): void {
    this.send({ type: 'unsubscribe', product_ids: productIds, channels });
  }

  private send(msg: CoinbaseSubscribeRequest): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else {
      this.emit('error', new Error('Cannot send: WebSocket is not open'));
    }
  }

  disconnect(): void {
    this.intentionallyClosed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export { CoinbaseService };
