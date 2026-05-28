import { OrderBook } from '../src/orderBook';

describe('OrderBook', () => {
  let book: OrderBook;

  beforeEach(() => {
    book = new OrderBook('BTC-USD');
  });

  // ─── applySnapshot ──────────────────────────────────────────────────────────

  describe('applySnapshot', () => {
    it('populates bids and asks from the initial snapshot', () => {
      book.applySnapshot(
        [['50000', '1.0'], ['49999', '2.0']],
        [['50001', '1.5'], ['50002', '0.5']]
      );
      const snap = book.getSnapshot();
      expect(snap.bids).toHaveLength(2);
      expect(snap.asks).toHaveLength(2);
    });

    it('replaces the entire book on a subsequent snapshot', () => {
      book.applySnapshot([['50000', '1.0']], [['50001', '1.0']]);
      book.applySnapshot([['49000', '3.0']], [['49001', '3.0']]);
      const snap = book.getSnapshot();
      expect(snap.bids).toHaveLength(1);
      expect(snap.bids[0].price).toBe('49000');
    });

    it('ignores zero-size levels in the snapshot', () => {
      book.applySnapshot([['50000', '0'], ['49999', '1.0']], []);
      expect(book.getBidCount()).toBe(1);
    });
  });

  // ─── applyUpdate ────────────────────────────────────────────────────────────

  describe('applyUpdate', () => {
    beforeEach(() => {
      book.applySnapshot(
        [['50000', '1.0'], ['49999', '2.0']],
        [['50001', '1.5']]
      );
    });

    it('updates an existing bid level', () => {
      book.applyUpdate([['buy', '50000', '3.0']]);
      const bid = book.getSnapshot().bids.find((b) => b.price === '50000');
      expect(bid?.size).toBe('3.0');
    });

    it('adds a new bid level', () => {
      book.applyUpdate([['buy', '49998', '5.0']]);
      expect(book.getBidCount()).toBe(3);
    });

    it('removes a bid level when size is "0"', () => {
      book.applyUpdate([['buy', '50000', '0']]);
      expect(book.getBidCount()).toBe(1);
      expect(book.getSnapshot().bids.find((b) => b.price === '50000')).toBeUndefined();
    });

    it('updates an existing ask level', () => {
      book.applyUpdate([['sell', '50001', '2.5']]);
      const ask = book.getSnapshot().asks.find((a) => a.price === '50001');
      expect(ask?.size).toBe('2.5');
    });

    it('removes an ask level when size is "0"', () => {
      book.applyUpdate([['sell', '50001', '0']]);
      expect(book.getAskCount()).toBe(0);
    });

    it('handles multiple changes in one update', () => {
      book.applyUpdate([
        ['buy', '50000', '0'],
        ['buy', '49997', '4.0'],
        ['sell', '50001', '2.0'],
      ]);
      expect(book.getBidCount()).toBe(2); // 49999 remains, new 49997
      const ask = book.getSnapshot().asks.find((a) => a.price === '50001');
      expect(ask?.size).toBe('2.0');
    });
  });

  // ─── getSnapshot ────────────────────────────────────────────────────────────

  describe('getSnapshot', () => {
    it('returns bids sorted descending by price', () => {
      book.applySnapshot(
        [['49999', '1.0'], ['50001', '2.0'], ['50000', '3.0']],
        []
      );
      const prices = book.getSnapshot().bids.map((b) => parseFloat(b.price));
      expect(prices).toEqual([...prices].sort((a, b) => b - a));
    });

    it('returns asks sorted ascending by price', () => {
      book.applySnapshot(
        [],
        [['50002', '1.0'], ['50001', '2.0'], ['50003', '3.0']]
      );
      const prices = book.getSnapshot().asks.map((a) => parseFloat(a.price));
      expect(prices).toEqual([...prices].sort((a, b) => a - b));
    });

    it('respects the depth limit for bids', () => {
      const bids: [string, string][] = Array.from({ length: 30 }, (_, i) => [
        `${50000 - i}`,
        '1.0',
      ]);
      book.applySnapshot(bids, []);
      expect(book.getSnapshot(10).bids).toHaveLength(10);
    });

    it('respects the depth limit for asks', () => {
      const asks: [string, string][] = Array.from({ length: 30 }, (_, i) => [
        `${50001 + i}`,
        '1.0',
      ]);
      book.applySnapshot([], asks);
      expect(book.getSnapshot(10).asks).toHaveLength(10);
    });

    it('includes a monotonically increasing timestamp', () => {
      book.applySnapshot([['50000', '1.0']], []);
      const t1 = book.getSnapshot().timestamp;
      const t2 = book.getSnapshot().timestamp;
      expect(t2).toBeGreaterThanOrEqual(t1);
    });

    it('returns the correct productId', () => {
      expect(book.getSnapshot().productId).toBe('BTC-USD');
    });
  });

  // ─── clear ──────────────────────────────────────────────────────────────────

  describe('clear', () => {
    it('empties bids and asks', () => {
      book.applySnapshot([['50000', '1.0']], [['50001', '1.0']]);
      book.clear();
      const snap = book.getSnapshot();
      expect(snap.bids).toHaveLength(0);
      expect(snap.asks).toHaveLength(0);
    });
  });
});
