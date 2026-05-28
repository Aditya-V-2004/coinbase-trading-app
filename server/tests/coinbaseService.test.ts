import { EventEmitter } from 'events';

// ─── Mock ws ─────────────────────────────────────────────────────────────────

let mockWsInstance: MockWs;

class MockWs extends EventEmitter {
  static OPEN = 1;
  static CLOSED = 3;
  readyState: number;
  send = jest.fn();
  close = jest.fn(() => {
    this.readyState = MockWs.CLOSED;
    this.emit('close');
  });

  constructor() {
    super();
    this.readyState = MockWs.OPEN;
    mockWsInstance = this;
  }
}

jest.mock('ws', () => MockWs);

import { CoinbaseService } from '../src/coinbaseService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fire = (type: string, data: Record<string, unknown> = {}): void => {
  mockWsInstance.emit('message', JSON.stringify({ type, ...data }));
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CoinbaseService', () => {
  let service: CoinbaseService;

  beforeEach(() => {
    jest.useFakeTimers();
    service = new CoinbaseService('wss://mock.coinbase.test', 1000);
  });

  afterEach(() => {
    service.disconnect();
    jest.useRealTimers();
  });

  describe('connect / connected event', () => {
    it('emits "connected" when the WebSocket opens', () => {
      const handler = jest.fn();
      service.on('connected', handler);
      service.connect();
      mockWsInstance.emit('open');
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('message routing', () => {
    beforeEach(() => {
      service.connect();
      mockWsInstance.emit('open');
    });

    it('emits "snapshot" for snapshot messages', () => {
      const handler = jest.fn();
      service.on('snapshot', handler);
      fire('snapshot', { product_id: 'BTC-USD', bids: [['50000', '1']], asks: [['50001', '1']] });
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0].product_id).toBe('BTC-USD');
    });

    it('emits "l2update" for l2update messages', () => {
      const handler = jest.fn();
      service.on('l2update', handler);
      fire('l2update', {
        product_id: 'BTC-USD',
        time: '2024-01-01T00:00:00Z',
        changes: [['buy', '50000', '2']],
      });
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('emits "match" for match messages', () => {
      const handler = jest.fn();
      service.on('match', handler);
      fire('match', {
        trade_id: 1, sequence: 1, maker_order_id: 'm', taker_order_id: 't',
        time: '2024-01-01T00:00:00Z', product_id: 'BTC-USD',
        size: '0.5', price: '50000', side: 'buy',
      });
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0].side).toBe('buy');
    });

    it('emits "match" for last_match messages', () => {
      const handler = jest.fn();
      service.on('match', handler);
      fire('last_match', {
        trade_id: 2, sequence: 2, maker_order_id: 'm', taker_order_id: 't',
        time: '2024-01-01T00:00:00Z', product_id: 'ETH-USD',
        size: '1.0', price: '3000', side: 'sell',
      });
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('emits "subscriptions" for subscriptions messages', () => {
      const handler = jest.fn();
      service.on('subscriptions', handler);
      fire('subscriptions', { channels: [{ name: 'level2', product_ids: ['BTC-USD'] }] });
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('emits "error" for error messages from Coinbase', () => {
      const handler = jest.fn();
      service.on('error', handler);
      fire('error', { message: 'bad product', reason: 'unknown' });
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0].message).toContain('bad product');
    });

    it('emits "error" for malformed JSON', () => {
      const handler = jest.fn();
      service.on('error', handler);
      mockWsInstance.emit('message', '{bad json');
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('subscribe / unsubscribe', () => {
    beforeEach(() => {
      service.connect();
      mockWsInstance.emit('open');
    });

    it('sends a subscribe message over the WebSocket', () => {
      service.subscribe(['BTC-USD'], ['level2', 'matches']);
      expect(mockWsInstance.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'subscribe', product_ids: ['BTC-USD'], channels: ['level2', 'matches'] })
      );
    });

    it('sends an unsubscribe message over the WebSocket', () => {
      service.unsubscribe(['ETH-USD'], ['level2']);
      expect(mockWsInstance.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'unsubscribe', product_ids: ['ETH-USD'], channels: ['level2'] })
      );
    });

    it('emits "error" when send is called before connect', () => {
      const closedService = new CoinbaseService('wss://x');
      const handler = jest.fn();
      closedService.on('error', handler);
      closedService.subscribe(['BTC-USD'], ['level2']);
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('reconnection', () => {
    it('reconnects after unexpected disconnection', () => {
      service.connect();
      const openHandler = jest.fn();
      service.on('connected', openHandler);
      // Simulate an unexpected close.
      mockWsInstance.readyState = MockWs.CLOSED;
      mockWsInstance.emit('close');
      // Advance timer by reconnect delay.
      jest.advanceTimersByTime(1000);
      mockWsInstance.emit('open');
      expect(openHandler).toHaveBeenCalledTimes(1);
    });

    it('does NOT reconnect after intentional disconnect', () => {
      service.connect();
      const disconnectedHandler = jest.fn();
      service.on('disconnected', disconnectedHandler);
      service.disconnect();
      jest.advanceTimersByTime(5000);
      expect(disconnectedHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('isConnected', () => {
    it('returns false before connecting', () => {
      expect(service.isConnected()).toBe(false);
    });

    it('returns true after the socket opens', () => {
      service.connect();
      // readyState is set to OPEN by MockWs constructor
      expect(service.isConnected()).toBe(true);
    });
  });
});
