import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Subscribe from './Subscribe';
import { ProductId, SUPPORTED_PRODUCTS } from '../../types';

const defaultProps = {
  subscribedProducts: new Set<ProductId>(),
  onSubscribe: jest.fn(),
  onUnsubscribe: jest.fn(),
};

describe('Subscribe', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders a card for each supported product', () => {
    render(<Subscribe {...defaultProps} />);
    for (const product of SUPPORTED_PRODUCTS) {
      expect(screen.getByText(product)).toBeInTheDocument();
    }
  });

  it('shows "Unsubscribed" badge when product is not subscribed', () => {
    render(<Subscribe {...defaultProps} />);
    const badges = screen.getAllByText('Unsubscribed');
    expect(badges).toHaveLength(SUPPORTED_PRODUCTS.length);
  });

  it('shows "Subscribed" badge when product is subscribed', () => {
    render(
      <Subscribe {...defaultProps} subscribedProducts={new Set<ProductId>(['BTC-USD'])} />
    );
    expect(screen.getByText('Subscribed')).toBeInTheDocument();
    expect(screen.getAllByText('Unsubscribed')).toHaveLength(SUPPORTED_PRODUCTS.length - 1);
  });

  it('calls onSubscribe with the correct product when Subscribe button is clicked', () => {
    const onSubscribe = jest.fn();
    render(<Subscribe {...defaultProps} onSubscribe={onSubscribe} />);
    // All buttons say "Subscribe" initially.
    const btns = screen.getAllByRole('button', { name: /subscribe/i });
    fireEvent.click(btns[0]); // BTC-USD is first in SUPPORTED_PRODUCTS
    expect(onSubscribe).toHaveBeenCalledWith('BTC-USD');
  });

  it('calls onUnsubscribe with the correct product when Unsubscribe button is clicked', () => {
    const onUnsubscribe = jest.fn();
    render(
      <Subscribe
        {...defaultProps}
        onUnsubscribe={onUnsubscribe}
        subscribedProducts={new Set<ProductId>(['ETH-USD'])}
      />
    );
    const btn = screen.getByRole('button', { name: /unsubscribe/i });
    fireEvent.click(btn);
    expect(onUnsubscribe).toHaveBeenCalledWith('ETH-USD');
  });

  it('shows Unsubscribe buttons for subscribed products and Subscribe buttons for unsubscribed ones', () => {
    render(
      <Subscribe
        {...defaultProps}
        subscribedProducts={new Set<ProductId>(['BTC-USD', 'ETH-USD'])}
      />
    );
    const unsubBtns = screen.getAllByRole('button', { name: /^unsubscribe$/i });
    const subBtns = screen.getAllByRole('button', { name: /^subscribe$/i });
    expect(unsubBtns).toHaveLength(2);
    expect(subBtns).toHaveLength(2);
  });
});
