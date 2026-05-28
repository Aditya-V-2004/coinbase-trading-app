import React from 'react';
import { render, screen } from '@testing-library/react';
import MatchView from './MatchView';
import { MatchData, ProductId } from '../../types';

const makeMatch = (overrides: Partial<MatchData> = {}): MatchData => ({
  tradeId: 1,
  time: '2024-06-01T12:00:00.000Z',
  productId: 'BTC-USD',
  size: '0.5',
  price: '50000',
  side: 'buy',
  ...overrides,
});

describe('MatchView', () => {
  it('prompts to subscribe when no products are subscribed', () => {
    render(<MatchView matches={[]} subscribedProducts={new Set()} />);
    expect(screen.getByText(/subscribe to a product/i)).toBeInTheDocument();
  });

  it('shows waiting message when subscribed but no matches received', () => {
    render(
      <MatchView matches={[]} subscribedProducts={new Set<ProductId>(['BTC-USD'])} />
    );
    expect(screen.getByText(/waiting for trades/i)).toBeInTheDocument();
  });

  it('renders a match row with correct product and price', () => {
    const matches = [makeMatch({ productId: 'BTC-USD', price: '50000', size: '0.5' })];
    render(
      <MatchView matches={matches} subscribedProducts={new Set<ProductId>(['BTC-USD'])} />
    );
    expect(screen.getByText('BTC-USD')).toBeInTheDocument();
    expect(screen.getByText('50000.00')).toBeInTheDocument();
  });

  it('applies buy CSS class to buy-side rows', () => {
    const matches = [makeMatch({ side: 'buy' })];
    const { container } = render(
      <MatchView matches={matches} subscribedProducts={new Set<ProductId>(['BTC-USD'])} />
    );
    const rows = container.querySelectorAll('tbody tr');
    expect(rows[0].className).toMatch(/buy/);
  });

  it('applies sell CSS class to sell-side rows', () => {
    const matches = [makeMatch({ side: 'sell' })];
    const { container } = render(
      <MatchView matches={matches} subscribedProducts={new Set<ProductId>(['BTC-USD'])} />
    );
    const rows = container.querySelectorAll('tbody tr');
    expect(rows[0].className).toMatch(/sell/);
  });

  it('filters out matches for unsubscribed products', () => {
    const matches = [
      makeMatch({ productId: 'BTC-USD', tradeId: 1 }),
      makeMatch({ productId: 'ETH-USD', tradeId: 2 }),
    ];
    render(
      <MatchView matches={matches} subscribedProducts={new Set<ProductId>(['BTC-USD'])} />
    );
    expect(screen.getAllByText('BTC-USD')).toHaveLength(1);
    expect(screen.queryByText('ETH-USD')).toBeNull();
  });

  it('shows the most recent match first (first item in array renders first)', () => {
    const matches = [
      makeMatch({ tradeId: 2, price: '50100' }),
      makeMatch({ tradeId: 1, price: '50000' }),
    ];
    render(
      <MatchView matches={matches} subscribedProducts={new Set<ProductId>(['BTC-USD'])} />
    );
    const rows = screen.getAllByRole('row');
    // rows[0] is thead; rows[1] is first data row
    expect(rows[1].textContent).toContain('50100.00');
  });

  it('renders the BUY label in uppercase', () => {
    render(
      <MatchView
        matches={[makeMatch({ side: 'buy' })]}
        subscribedProducts={new Set<ProductId>(['BTC-USD'])}
      />
    );
    expect(screen.getByText('BUY')).toBeInTheDocument();
  });

  it('renders the SELL label in uppercase', () => {
    render(
      <MatchView
        matches={[makeMatch({ side: 'sell' })]}
        subscribedProducts={new Set<ProductId>(['BTC-USD'])}
      />
    );
    expect(screen.getByText('SELL')).toBeInTheDocument();
  });
});
