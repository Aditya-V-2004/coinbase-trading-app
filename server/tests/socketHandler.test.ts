import { EventEmitter } from 'events';
import { SocketHandler } from '../src/socketHandler';

// ─── Lightweight mock of CoinbaseService ────────────────────────────────────

class MockCoinbaseService extends EventEmitter {
  subscribe = jest.fn();
  unsubscribe = jest.fn();
  isConnected = jest.fn().mockReturnValue(true);
}

// ─── Lightweight mock of OrderBookPoller ─────────────────────────────────────

class MockOrderBookPoller extends EventEmitter {
  subscribe = jest.fn();
  unsubscribe = jest.fn();
  cleanup = jest.fn();
  isPolling = jest.fn().mockReturnValue(false);
}

// ─── Lightweight mock of Socket.io ──────────────────────────────────────────

class MockSocket extends EventEmitter {
  id: string;
  rooms: Set<string>;
  joinedRooms: string[] = [];
  leftRooms: string[] = [];
  outboundEvents: Array<{ event: string; data: unknown }> = [];

  constructor(id: string) {
    super();
    this.id = id;
    this.rooms = new Set([id]);
  }

  join(room: string): void {
    this.rooms.add(room);
    this.joinedRooms.push(room);
  }

  leave(room: string): void {
    this.rooms.delete(room);
    this.leftRooms.push(room);
  }

  /**
   * When the SocketHandler calls socket.emit(...) to push data to the client,
   * we capture it in `outboundEvents`.
   * When the test calls socket.emit(...) to simulate a client message,
   * we delegate to EventEmitter so the SocketHandler's listeners fire.
   * We differentiate by checking whether the event has registered listeners.
   */
  emit(event: string, ...args: unknown[]): boolean {
    if (this.listenerCount(event) > 0) {
      // Simulated client message — fire EventEmitter listeners
      return super.emit(event, ...args);
    }
    // Outbound push from server — capture for assertions
    this.outboundEvents.push({ event, data: args[0] });
    return true;
  }

  /** Expose outboundEvents as "emittedEvents" for backward-compatible test reads. */
  get emittedEvents(): Array<{ event: string; data: unknown }> {
    return this.outboundEvents;
  }
}

class MockServer extends EventEmitter {
  broadcastEvents: Array<{ event: string; data: unknown }> = [];
  roomEmits: Array<{ room: string; event: string; data: unknown }> = [];
  private _room: string | null = null;

  to(room: string): this {
    this._room = room;
    return this;
  }

  emit(event: string, ...args: unknown[]): boolean {
    if (this._room) {
      this.roomEmits.push({ room: this._room, event, data: args[0] });
      this._room = null;
      return true;
    }
    // For broadcasts, record AND fire EventEmitter so internal listeners (e.g. 'connection') work.
    this.broadcastEvents.push({ event, data: args[0] });
    return super.emit(event, ...args);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function setup(pushIntervalMs = 10_000) {
  jest.useFakeTimers();
  const coinbase = new MockCoinbaseService();
  const bookPoller = new MockOrderBookPoller();
  const io = new MockServer();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handler = new SocketHandler(io as any, coinbase as any, bookPoller as any, pushIntervalMs);
  return { coinbase, bookPoller, io, handler };
}

function makeSocket(id: string): MockSocket {
  return new MockSocket(id);
}

function connectSocket(io: MockServer, socket: MockSocket): void {
  io.emit('connection', socket);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SocketHandler', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  describe('client connection', () => {
    it('sends current subscriptions_update to a newly connected client', () => {
      const { coinbase, io } = setup();
      // Simulate Coinbase sending a subscriptions message before client connects.
      coinbase.emit('subscriptions', { type: 'subscriptions', channels: [{ name: 'level2', product_ids: ['BTC-USD'] }] });

      const socket = makeSocket('s1');
      connectSocket(io, socket);

      const ev = socket.emittedEvents.find((e) => e.event === 'subscriptions_update');
      expect(ev).toBeDefined();
    });
  });

  describe('subscribe', () => {
    it('joins the product room and emits subscription_status: true', () => {
      const { io } = setup();
      const socket = makeSocket('s1');
      connectSocket(io, socket);

      socket.emit('subscribe', 'BTC-USD');
      expect(socket.joinedRooms).toContain('BTC-USD');
      const statusEv = socket.emittedEvents.find(
        (e) => e.event === 'subscription_status' && (e.data as Record<string, unknown>)['subscribed'] === true
      );
      expect(statusEv).toBeDefined();
    });

    it('calls coinbase.subscribe (matches) and bookPoller.subscribe when the first client subscribes', () => {
      const { coinbase, bookPoller, io } = setup();
      const socket = makeSocket('s1');
      connectSocket(io, socket);
      socket.emit('subscribe', 'ETH-USD');
      expect(coinbase.subscribe).toHaveBeenCalledWith(['ETH-USD'], expect.any(Array));
      expect(bookPoller.subscribe).toHaveBeenCalledWith('ETH-USD');
    });

    it('does NOT call coinbase.subscribe again when a second client subscribes to the same product', () => {
      const { coinbase, io } = setup();
      const s1 = makeSocket('s1');
      const s2 = makeSocket('s2');
      connectSocket(io, s1);
      connectSocket(io, s2);
      s1.emit('subscribe', 'BTC-USD');
      s2.emit('subscribe', 'BTC-USD');
      expect(coinbase.subscribe).toHaveBeenCalledTimes(1);
    });

    it('emits server_error for an unsupported product', () => {
      const { io } = setup();
      const socket = makeSocket('s1');
      connectSocket(io, socket);
      socket.emit('subscribe', 'DOGE-USD');
      const errEv = socket.emittedEvents.find((e) => e.event === 'server_error');
      expect(errEv).toBeDefined();
    });

    it('is idempotent — does not double-join or double-subscribe', () => {
      const { coinbase, io } = setup();
      const socket = makeSocket('s1');
      connectSocket(io, socket);
      socket.emit('subscribe', 'BTC-USD');
      socket.emit('subscribe', 'BTC-USD');
      expect(coinbase.subscribe).toHaveBeenCalledTimes(1);
      expect(socket.joinedRooms.filter((r) => r === 'BTC-USD')).toHaveLength(1);
    });
  });

  describe('unsubscribe', () => {
    it('leaves the product room and emits subscription_status: false', () => {
      const { io } = setup();
      const socket = makeSocket('s1');
      connectSocket(io, socket);
      socket.emit('subscribe', 'BTC-USD');
      socket.emit('unsubscribe', 'BTC-USD');
      expect(socket.leftRooms).toContain('BTC-USD');
      const statusEv = socket.emittedEvents.find(
        (e) => e.event === 'subscription_status' && (e.data as Record<string, unknown>)['subscribed'] === false
      );
      expect(statusEv).toBeDefined();
    });

    it('calls coinbase.unsubscribe and bookPoller.unsubscribe when the last subscriber leaves', () => {
      const { coinbase, bookPoller, io } = setup();
      const socket = makeSocket('s1');
      connectSocket(io, socket);
      socket.emit('subscribe', 'BTC-USD');
      socket.emit('unsubscribe', 'BTC-USD');
      expect(coinbase.unsubscribe).toHaveBeenCalledWith(['BTC-USD'], expect.any(Array));
      expect(bookPoller.unsubscribe).toHaveBeenCalledWith('BTC-USD');
    });

    it('does NOT call coinbase.unsubscribe while other clients are still subscribed', () => {
      const { coinbase, io } = setup();
      const s1 = makeSocket('s1');
      const s2 = makeSocket('s2');
      connectSocket(io, s1);
      connectSocket(io, s2);
      s1.emit('subscribe', 'BTC-USD');
      s2.emit('subscribe', 'BTC-USD');
      s1.emit('unsubscribe', 'BTC-USD');
      expect(coinbase.unsubscribe).not.toHaveBeenCalled();
    });
  });

  describe('disconnect cleanup', () => {
    it('decrements subscription count and unsubscribes from Coinbase when last client disconnects', () => {
      const { coinbase, io } = setup();
      const socket = makeSocket('s1');
      connectSocket(io, socket);
      socket.emit('subscribe', 'BTC-USD');
      socket.emit('disconnect');
      expect(coinbase.unsubscribe).toHaveBeenCalledWith(['BTC-USD'], expect.any(Array));
    });

    it('does not unsubscribe from Coinbase if another client is still subscribed', () => {
      const { coinbase, io } = setup();
      const s1 = makeSocket('s1');
      const s2 = makeSocket('s2');
      connectSocket(io, s1);
      connectSocket(io, s2);
      s1.emit('subscribe', 'BTC-USD');
      s2.emit('subscribe', 'BTC-USD');
      s1.emit('disconnect');
      expect(coinbase.unsubscribe).not.toHaveBeenCalled();
    });
  });

  describe('order book push interval', () => {
    it('pushes orderbook_update to the product room at the configured interval', () => {
      const { coinbase, io } = setup(100);
      const socket = makeSocket('s1');
      connectSocket(io, socket);
      socket.emit('subscribe', 'BTC-USD');

      // Feed a snapshot so the book has data.
      coinbase.emit('snapshot', {
        type: 'snapshot',
        product_id: 'BTC-USD',
        bids: [['50000', '1.0']],
        asks: [['50001', '1.0']],
      });

      jest.advanceTimersByTime(100);

      const update = io.roomEmits.find(
        (e) => e.room === 'BTC-USD' && e.event === 'orderbook_update'
      );
      expect(update).toBeDefined();
    });
  });

  describe('match forwarding', () => {
    it('emits match to the correct product room', () => {
      const { coinbase, io } = setup();
      const socket = makeSocket('s1');
      connectSocket(io, socket);
      socket.emit('subscribe', 'BTC-USD');

      coinbase.emit('match', {
        type: 'match',
        trade_id: 1, sequence: 1,
        maker_order_id: 'm', taker_order_id: 't',
        time: '2024-01-01T00:00:00Z',
        product_id: 'BTC-USD',
        size: '0.1', price: '50000', side: 'buy',
      });

      const matchEmit = io.roomEmits.find((e) => e.room === 'BTC-USD' && e.event === 'match');
      expect(matchEmit).toBeDefined();
    });
  });

  describe('subscriptions_update broadcast', () => {
    it('broadcasts subscriptions_update to all clients when Coinbase responds', () => {
      const { coinbase, io } = setup();
      coinbase.emit('subscriptions', {
        type: 'subscriptions',
        channels: [{ name: 'level2', product_ids: ['BTC-USD'] }],
      });
      const ev = io.broadcastEvents.find((e) => e.event === 'subscriptions_update');
      expect(ev).toBeDefined();
    });
  });
});
