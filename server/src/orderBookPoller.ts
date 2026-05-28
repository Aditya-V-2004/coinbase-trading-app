import https from 'https';
import { EventEmitter } from 'events';
import { CoinbaseSnapshotMessage } from './types';

interface RestBookResponse {
  bids: [string, string, number][];
  asks: [string, string, number][];
}

export interface OrderBookPollerEvents {
  snapshot: (msg: CoinbaseSnapshotMessage) => void;
  error: (err: Error) => void;
}

declare interface OrderBookPoller {
  on<K extends keyof OrderBookPollerEvents>(event: K, listener: OrderBookPollerEvents[K]): this;
  emit<K extends keyof OrderBookPollerEvents>(
    event: K,
    ...args: Parameters<OrderBookPollerEvents[K]>
  ): boolean;
}

/**
 * Polls the Coinbase Exchange REST API for level-2 order book data.
 *
 * The WebSocket level2 channel now requires authentication on the Exchange
 * API, so we fall back to the public REST endpoint:
 *   GET /products/{product_id}/book?level=2
 *
 * Each poll emits a `snapshot` event with the same shape as the WS snapshot
 * message, keeping downstream consumers (OrderBook, SocketHandler) unchanged.
 */
class OrderBookPoller extends EventEmitter {
  private readonly apiBase: string;
  private readonly pollIntervalMs: number;
  private readonly timers = new Map<string, ReturnType<typeof setInterval>>();

  constructor(apiBase: string, pollIntervalMs = 1000) {
    super();
    this.apiBase = apiBase;
    this.pollIntervalMs = pollIntervalMs;
  }

  subscribe(productId: string): void {
    if (this.timers.has(productId)) return;
    // Fetch immediately so the UI fills right away, then keep polling.
    this.fetchAndEmit(productId);
    const timer = setInterval(() => this.fetchAndEmit(productId), this.pollIntervalMs);
    this.timers.set(productId, timer);
  }

  unsubscribe(productId: string): void {
    const timer = this.timers.get(productId);
    if (timer) {
      clearInterval(timer);
      this.timers.delete(productId);
    }
  }

  private fetchAndEmit(productId: string): void {
    const url = `${this.apiBase}/products/${productId}/book?level=2`;

    https
      .get(url, { headers: { 'User-Agent': 'coinbase-trading-app/1.0' } }, (res) => {
        let raw = '';
        res.on('data', (chunk: Buffer) => {
          raw += chunk.toString();
        });
        res.on('end', () => {
          try {
            const body = JSON.parse(raw) as RestBookResponse;
            if (!body.bids || !body.asks) return;

            const snapshot: CoinbaseSnapshotMessage = {
              type: 'snapshot',
              product_id: productId,
              // REST returns [price, size, num-orders] — we only need [price, size]
              bids: body.bids.map(([price, size]) => [price, size]),
              asks: body.asks.map(([price, size]) => [price, size]),
            };
            this.emit('snapshot', snapshot);
          } catch (err) {
            this.emit(
              'error',
              new Error(`Failed to parse order book for ${productId}: ${String(err)}`)
            );
          }
        });
      })
      .on('error', (err: Error) => {
        this.emit(
          'error',
          new Error(`Order book fetch failed for ${productId}: ${err.message}`)
        );
      });
  }

  cleanup(): void {
    for (const timer of this.timers.values()) clearInterval(timer);
    this.timers.clear();
  }

  isPolling(productId: string): boolean {
    return this.timers.has(productId);
  }
}

export { OrderBookPoller };
