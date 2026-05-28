import React from 'react';
import { render, screen } from '@testing-library/react';
import SystemStatus from './SystemStatus';
import { ChannelEntry } from '../../types';

describe('SystemStatus', () => {
  it('shows Connected when connected is true', () => {
    render(<SystemStatus channels={[]} connected={true} />);
    expect(screen.getByText('Connected')).toBeInTheDocument();
  });

  it('shows Disconnected when connected is false', () => {
    render(<SystemStatus channels={[]} connected={false} />);
    expect(screen.getByText('Disconnected')).toBeInTheDocument();
  });

  it('shows empty state when there are no channels', () => {
    render(<SystemStatus channels={[]} connected={true} />);
    expect(screen.getByText(/no active channels/i)).toBeInTheDocument();
  });

  it('renders each channel name', () => {
    const channels: ChannelEntry[] = [
      { name: 'level2', product_ids: ['BTC-USD'] },
      { name: 'matches', product_ids: ['BTC-USD', 'ETH-USD'] },
    ];
    render(<SystemStatus channels={channels} connected={true} />);
    expect(screen.getByText('level2')).toBeInTheDocument();
    expect(screen.getByText('matches')).toBeInTheDocument();
  });

  it('renders product tags within each channel', () => {
    const channels: ChannelEntry[] = [
      { name: 'level2', product_ids: ['BTC-USD', 'ETH-USD'] },
    ];
    render(<SystemStatus channels={channels} connected={true} />);
    expect(screen.getByText('BTC-USD')).toBeInTheDocument();
    expect(screen.getByText('ETH-USD')).toBeInTheDocument();
  });

  it('renders a dash placeholder when a channel has no products', () => {
    const channels: ChannelEntry[] = [{ name: 'heartbeat', product_ids: [] }];
    render(<SystemStatus channels={channels} connected={true} />);
    expect(screen.getByText('\u2014')).toBeInTheDocument();
  });

  it('renders multiple channels with independent product lists', () => {
    const channels: ChannelEntry[] = [
      { name: 'level2', product_ids: ['BTC-USD'] },
      { name: 'matches', product_ids: ['ETH-USD'] },
    ];
    render(<SystemStatus channels={channels} connected={false} />);
    expect(screen.getByText('level2')).toBeInTheDocument();
    expect(screen.getByText('matches')).toBeInTheDocument();
    expect(screen.getByText('BTC-USD')).toBeInTheDocument();
    expect(screen.getByText('ETH-USD')).toBeInTheDocument();
  });
});
