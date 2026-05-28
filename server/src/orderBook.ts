import { OrderBookLevel, OrderBookSnapshot } from './types';

/**
 * Maintains a level-2 order book for a single product.
 *
 * Internally uses Maps keyed by price string for O(1) lookup and update.
 * When emitting snapshots the levels are sorted and depth-limited so clients
 * always receive a compact, ready-to-render payload.
 */
export class OrderBook {
  private readonly bids: Map<string, string> = new Map(); // price → size
  private readonly asks: Map<string, string> = new Map(); // price → size
  private readonly productId: string;

  constructor(productId: string) {
    this.productId = productId;
  }

  /**
   * Replace the entire book with a snapshot received from Coinbase.
   */
  applySnapshot(bids: [string, string][], asks: [string, string][]): void {
    this.bids.clear();
    this.asks.clear();

    for (const [price, size] of bids) {
      if (parseFloat(size) > 0) this.bids.set(price, size);
    }
    for (const [price, size] of asks) {
      if (parseFloat(size) > 0) this.asks.set(price, size);
    }
  }

  /**
   * Apply an l2update diff.  A size of "0" means the level was removed.
   */
  applyUpdate(changes: [string, string, string][]): void {
    for (const [side, price, size] of changes) {
      const book = side === 'buy' ? this.bids : this.asks;
      if (parseFloat(size) === 0) {
        book.delete(price);
      } else {
        book.set(price, size);
      }
    }
  }

  /**
   * Return a sorted, depth-limited snapshot suitable for sending to clients.
   * Bids are sorted descending (best bid first), asks ascending (best ask first).
   */
  getSnapshot(depth = 20): OrderBookSnapshot {
    const bids: OrderBookLevel[] = Array.from(this.bids.entries())
      .map(([price, size]) => ({ price, size }))
      .sort((a, b) => parseFloat(b.price) - parseFloat(a.price))
      .slice(0, depth);

    const asks: OrderBookLevel[] = Array.from(this.asks.entries())
      .map(([price, size]) => ({ price, size }))
      .sort((a, b) => parseFloat(a.price) - parseFloat(b.price))
      .slice(0, depth);

    return { productId: this.productId, bids, asks, timestamp: Date.now() };
  }

  getBidCount(): number {
    return this.bids.size;
  }

  getAskCount(): number {
    return this.asks.size;
  }

  clear(): void {
    this.bids.clear();
    this.asks.clear();
  }
}
