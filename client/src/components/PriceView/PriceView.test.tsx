import React from 'react';
import { render, screen } from '@testing-library/react';
import PriceView from './PriceView';
import { ProductId, OrderBookSnapshot } from '../../types';

const makeSnapshot = (productId: string): OrderBookSnapshot => ({
  productId,
  bids: [
    { price: '50000', size: '1.5' },
    { price: '49999', size: '2.0' },
  ],
  asks: [
    { price: '50001', size: '1.0' },
    { price: '50002', size: '0.5' },
  ],
  timestamp: Date.now(),
});

describe('PriceView', () => {
  it('shows empty state when no products are subscribed', () => {
    render(<PriceView orderBooks={new Map()} subscribedProducts={new Set()} />);
    expect(screen.getByText(/no products subscribed/i)).toBeInTheDocument();
  });

  it('renders the product name for each subscribed product', () => {
    const orderBooks = new Map<ProductId, OrderBookSnapshot>([
      ['BTC-USD', makeSnapshot('BTC-USD')],
    ]);
    render(
      <PriceView
        orderBooks={orderBooks}
        subscribedProducts={new Set<ProductId>(['BTC-USD'])}
      />
    );
    expect(screen.getByText('BTC-USD')).toBeInTheDocument();
  });

  it('displays bid prices for a subscribed product', () => {
    const orderBooks = new Map<ProductId, OrderBookSnapshot>([
      ['BTC-USD', makeSnapshot('BTC-USD')],
    ]);
    render(
      <PriceView
        orderBooks={orderBooks}
        subscribedProducts={new Set<ProductId>(['BTC-USD'])}
      />
    );
    expect(screen.getAllByText('50000.00').length).toBeGreaterThan(0);
  });

  it('displays ask prices for a subscribed product', () => {
    const orderBooks = new Map<ProductId, OrderBookSnapshot>([
      ['BTC-USD', makeSnapshot('BTC-USD')],
    ]);
    render(
      <PriceView
        orderBooks={orderBooks}
        subscribedProducts={new Set<ProductId>(['BTC-USD'])}
      />
    );
    expect(screen.getAllByText('50001.00').length).toBeGreaterThan(0);
  });

  it('shows "Waiting…" when subscribed but no snapshot received yet', () => {
    render(
      <PriceView
        orderBooks={new Map()}
        subscribedProducts={new Set<ProductId>(['ETH-USD'])}
      />
    );
    expect(screen.getAllByText('Waiting\u2026').length).toBeGreaterThanOrEqual(1);
  });

  it('renders multiple subscribed products', () => {
    const orderBooks = new Map<ProductId, OrderBookSnapshot>([
      ['BTC-USD', makeSnapshot('BTC-USD')],
      ['ETH-USD', makeSnapshot('ETH-USD')],
    ]);
    render(
      <PriceView
        orderBooks={orderBooks}
        subscribedProducts={new Set<ProductId>(['BTC-USD', 'ETH-USD'])}
      />
    );
    expect(screen.getByText('BTC-USD')).toBeInTheDocument();
    expect(screen.getByText('ETH-USD')).toBeInTheDocument();
  });
});
