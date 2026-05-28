import { Server, Socket } from 'socket.io';
import { CoinbaseService } from './coinbaseService';
import { OrderBookPoller } from './orderBookPoller';
import { OrderBook } from './orderBook';
import {
  ProductId,
  SUPPORTED_PRODUCTS,
  TRADE_CHANNELS,
  ServerToClientEvents,
  ClientToServerEvents,
  MatchData,
  ChannelEntry,
} from './types';

type AppServer = Server<ClientToServerEvents, ServerToClientEvents>;
type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

/**
 * Bridges live data sources and connected Socket.io clients.
 *
 * Data sources:
 *  - CoinbaseService (WebSocket) → matches channel only.
 *    The level2 WS channel now requires authentication on the Exchange API.
 *  - OrderBookPoller (REST polling) → public /products/{id}/book?level=2
 *    Polled at ORDER_BOOK_POLL_INTERVAL_MS; result is held in an OrderBook
 *    instance and pushed to subscribed clients every PUSH_INTERVAL_MS.
 *
 * Fan-out uses Socket.io rooms (one room = one ProductId) so the server
 * only emits once per product regardless of the number of subscribers.
 */
export class SocketHandler {
  private readonly io: AppServer;
  private readonly coinbase: CoinbaseService;
  private readonly bookPoller: OrderBookPoller;
  private readonly orderBooks = new Map<ProductId, OrderBook>();
  private readonly globalSubCount = new Map<ProductId, number>();
  private readonly pushIntervals = new Map<ProductId, ReturnType<typeof setInterval>>();
  private readonly pushIntervalMs: number;
  private readonly orderBookDepth: number;
  private currentChannels: ChannelEntry[] = [];

  constructor(
    io: AppServer,
    coinbase: CoinbaseService,
    bookPoller: OrderBookPoller,
    pushIntervalMs = 50,
    orderBookDepth = 20
  ) {
    this.io = io;
    this.coinbase = coinbase;
    this.bookPoller = bookPoller;
    this.pushIntervalMs = pushIntervalMs;
    this.orderBookDepth = orderBookDepth;

    for (const product of SUPPORTED_PRODUCTS) {
      this.orderBooks.set(product, new OrderBook(product));
      this.globalSubCount.set(product, 0);
    }

    this.bindCoinbaseEvents();
    this.bindPollerEvents();
    this.bindSocketEvents();
  }

  // ─── Coinbase WebSocket events (matches only) ─────────────────────────────

  private bindCoinbaseEvents(): void {
    this.coinbase.on('match', (msg) => {
      const matchData: MatchData = {
        tradeId: msg.trade_id,
        time: msg.time,
        productId: msg.product_id,
        size: msg.size,
        price: msg.price,
        side: msg.side,
      };
      this.io.to(msg.product_id).emit('match', matchData);
    });

    this.coinbase.on('subscriptions', (msg) => {
      this.currentChannels = msg.channels;
      this.io.emit('subscriptions_update', msg.channels);
    });

    this.coinbase.on('connected', () => {
      console.log('[Coinbase] WebSocket connected');
    });

    this.coinbase.on('disconnected', () => {
      console.warn('[Coinbase] WebSocket disconnected — will reconnect');
    });

    this.coinbase.on('error', (err) => {
      console.error('[Coinbase] Error:', err.message);
    });
  }

  // ─── REST order book poller events ───────────────────────────────────────

  private bindPollerEvents(): void {
    this.bookPoller.on('snapshot', (msg) => {
      this.orderBooks.get(msg.product_id as ProductId)?.applySnapshot(msg.bids, msg.asks);
    });

    this.bookPoller.on('error', (err) => {
      console.error('[OrderBookPoller] Error:', err.message);
    });
  }

  // ─── Socket.io client events ──────────────────────────────────────────────

  private bindSocketEvents(): void {
    this.io.on('connection', (socket: AppSocket) => {
      console.log(`[Socket] Client connected: ${socket.id}`);
      socket.emit('subscriptions_update', this.currentChannels);

      socket.on('subscribe', (productId: string) => {
        this.handleSubscribe(socket, productId);
      });

      socket.on('unsubscribe', (productId: string) => {
        this.handleUnsubscribe(socket, productId);
      });

      socket.on('disconnect', () => {
        console.log(`[Socket] Client disconnected: ${socket.id}`);
        this.cleanupClient(socket);
      });
    });
  }

  // ─── Subscription management ──────────────────────────────────────────────

  private handleSubscribe(socket: AppSocket, productId: string): void {
    if (!SUPPORTED_PRODUCTS.includes(productId as ProductId)) {
      socket.emit('server_error', `Unsupported product: ${productId}`);
      return;
    }

    const product = productId as ProductId;
    if (socket.rooms.has(product)) return;

    socket.join(product);

    const prev = this.globalSubCount.get(product) ?? 0;
    this.globalSubCount.set(product, prev + 1);

    if (prev === 0) {
      // First subscriber: start both data sources for this product.
      this.coinbase.subscribe([product], [...TRADE_CHANNELS]);
      this.bookPoller.subscribe(product);
      this.startPushInterval(product);
    }

    socket.emit('subscription_status', { productId: product, subscribed: true });
  }

  private handleUnsubscribe(socket: AppSocket, productId: string): void {
    if (!SUPPORTED_PRODUCTS.includes(productId as ProductId)) {
      socket.emit('server_error', `Unsupported product: ${productId}`);
      return;
    }

    const product = productId as ProductId;
    if (!socket.rooms.has(product)) return;

    socket.leave(product);
    this.decrementAndMaybeStop(product);

    socket.emit('subscription_status', { productId: product, subscribed: false });
  }

  private cleanupClient(socket: AppSocket): void {
    for (const product of SUPPORTED_PRODUCTS) {
      if (socket.rooms.has(product)) {
        socket.leave(product);
        this.decrementAndMaybeStop(product);
      }
    }
  }

  private decrementAndMaybeStop(product: ProductId): void {
    const prev = this.globalSubCount.get(product) ?? 0;
    const next = Math.max(0, prev - 1);
    this.globalSubCount.set(product, next);

    if (next === 0) {
      this.coinbase.unsubscribe([product], [...TRADE_CHANNELS]);
      this.bookPoller.unsubscribe(product);
      this.stopPushInterval(product);
      this.orderBooks.get(product)?.clear();
    }
  }

  // ─── Order book push loop (50 ms) ─────────────────────────────────────────

  private startPushInterval(product: ProductId): void {
    if (this.pushIntervals.has(product)) return;

    const interval = setInterval(() => {
      const snapshot = this.orderBooks.get(product)?.getSnapshot(this.orderBookDepth);
      if (snapshot) {
        this.io.to(product).emit('orderbook_update', snapshot);
      }
    }, this.pushIntervalMs);

    this.pushIntervals.set(product, interval);
  }

  private stopPushInterval(product: ProductId): void {
    const interval = this.pushIntervals.get(product);
    if (interval) {
      clearInterval(interval);
      this.pushIntervals.delete(product);
    }
  }

  cleanup(): void {
    for (const interval of this.pushIntervals.values()) clearInterval(interval);
    this.pushIntervals.clear();
    this.bookPoller.cleanup();
  }
}
