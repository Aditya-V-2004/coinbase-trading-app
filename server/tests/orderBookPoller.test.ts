import { EventEmitter } from 'events';
import { OrderBookPoller } from '../src/orderBookPoller';

// ─── Synchronous https mock ────────────────────────────────────────────────
// Calling the response callback synchronously (no setImmediate) keeps the
// tests simple and avoids interactions with fake timers.

interface MockState {
  body: string;
  error: Error | null;
}

const state: MockState = {
  body: '',
  error: null,
};

jest.mock('https', () => ({
  get: jest.fn((_url: string, _opts: unknown, callback: (res: EventEmitter) => void) => {
    const req = new EventEmitter();

    if (state.error) {
      // Emit error on the request object synchronously.
      process.nextTick(() => req.emit('error', state.error));
      return req;
    }

    const res = new EventEmitter();
    callback(res);
    res.emit('data', Buffer.from(state.body));
    res.emit('end');

    return req;
  }),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

const validBook = JSON.stringify({
  bids: [['73000', '1.5', 2], ['72999', '2.0', 1]],
  asks: [['73001', '0.5', 1], ['73002', '1.0', 3]],
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('OrderBookPoller', () => {
  let poller: OrderBookPoller;

  beforeEach(() => {
    state.body = validBook;
    state.error = null;
    poller = new OrderBookPoller('https://api.exchange.coinbase.com', 1000);
  });

  afterEach(() => {
    poller.cleanup();
    jest.clearAllTimers();
  });

  describe('subscribe', () => {
    it('emits a snapshot synchronously on first subscribe', () => {
      const handler = jest.fn();
      poller.on('snapshot', handler);
      poller.subscribe('BTC-USD');
      expect(handler).toHaveBeenCalledTimes(1);
      const msg = handler.mock.calls[0][0];
      expect(msg.type).toBe('snapshot');
      expect(msg.product_id).toBe('BTC-USD');
      expect(msg.bids.length).toBeGreaterThan(0);
      expect(msg.asks.length).toBeGreaterThan(0);
    });

    it('maps REST [price, size, num-orders] to [price, size] tuples', () => {
      const handler = jest.fn();
      poller.on('snapshot', handler);
      poller.subscribe('BTC-USD');
      const msg = handler.mock.calls[0][0];
      expect(msg.bids[0]).toHaveLength(2);
      expect(msg.asks[0]).toHaveLength(2);
      expect(msg.bids[0][0]).toBe('73000');
      expect(msg.bids[0][1]).toBe('1.5');
    });

    it('polls again at the configured interval', () => {
      jest.useFakeTimers();
      const handler = jest.fn();
      poller.on('snapshot', handler);
      poller.subscribe('BTC-USD');
      expect(handler).toHaveBeenCalledTimes(1); // immediate
      jest.advanceTimersByTime(1000);
      expect(handler).toHaveBeenCalledTimes(2); // after 1 interval
      jest.advanceTimersByTime(1000);
      expect(handler).toHaveBeenCalledTimes(3); // after 2 intervals
      jest.useRealTimers();
    });

    it('is idempotent — does not start a second timer if already subscribed', () => {
      const handler = jest.fn();
      poller.on('snapshot', handler);
      poller.subscribe('BTC-USD');
      poller.subscribe('BTC-USD'); // second call is a no-op
      expect(handler).toHaveBeenCalledTimes(1);
      expect(poller.isPolling('BTC-USD')).toBe(true);
    });
  });

  describe('unsubscribe', () => {
    it('stops polling after unsubscribe', () => {
      jest.useFakeTimers();
      const handler = jest.fn();
      poller.on('snapshot', handler);
      poller.subscribe('BTC-USD');
      poller.unsubscribe('BTC-USD');
      expect(poller.isPolling('BTC-USD')).toBe(false);
      jest.advanceTimersByTime(5000);
      expect(handler).toHaveBeenCalledTimes(1); // only the immediate, never the interval
      jest.useRealTimers();
    });
  });

  describe('error handling', () => {
    it('emits error on request failure', (done) => {
      state.error = new Error('network failure');
      poller.on('error', (err) => {
        expect(err.message).toContain('BTC-USD');
        done();
      });
      poller.subscribe('BTC-USD');
    });

    it('emits error on invalid JSON response', () => {
      state.body = 'not valid json{';
      const handler = jest.fn();
      poller.on('error', handler);
      poller.subscribe('BTC-USD');
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0].message).toContain('BTC-USD');
    });

    it('silently ignores a response body with no bids/asks fields', () => {
      state.body = JSON.stringify({ message: 'Not found' });
      const snapshotHandler = jest.fn();
      const errorHandler = jest.fn();
      poller.on('snapshot', snapshotHandler);
      poller.on('error', errorHandler);
      poller.subscribe('BTC-USD');
      expect(snapshotHandler).not.toHaveBeenCalled();
      expect(errorHandler).not.toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('stops all active polling timers', () => {
      jest.useFakeTimers();
      const handler = jest.fn();
      poller.on('snapshot', handler);
      poller.subscribe('BTC-USD');
      poller.subscribe('ETH-USD');
      handler.mockClear();

      poller.cleanup();
      expect(poller.isPolling('BTC-USD')).toBe(false);
      expect(poller.isPolling('ETH-USD')).toBe(false);
      jest.advanceTimersByTime(5000);
      expect(handler).not.toHaveBeenCalled();
      jest.useRealTimers();
    });
  });
});
