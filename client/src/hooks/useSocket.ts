import { useState, useEffect, useCallback } from 'react';
import { socket } from '../socket';
import {
  ProductId,
  OrderBookSnapshot,
  MatchData,
  ChannelEntry,
} from '../types';

const MAX_MATCHES = parseInt(import.meta.env.VITE_MAX_MATCHES ?? '200', 10);

export interface SocketState {
  connected: boolean;
  subscribedProducts: Set<ProductId>;
  orderBooks: Map<ProductId, OrderBookSnapshot>;
  matches: MatchData[];
  channels: ChannelEntry[];
  serverError: string | null;
}

/**
 * Central hook that owns the Socket.io event subscriptions and surfaces
 * reactive state to the rest of the UI.
 *
 * State update notes:
 *  - `orderBooks` and `subscribedProducts` use functional updaters to avoid
 *    stale-closure issues in event callbacks.
 *  - `matches` are prepended (most-recent-first) and capped at MAX_MATCHES to
 *    prevent unbounded memory growth.
 */
export function useSocket(): SocketState & {
  subscribe: (productId: ProductId) => void;
  unsubscribe: (productId: ProductId) => void;
} {
  const [connected, setConnected] = useState<boolean>(socket.connected);
  const [subscribedProducts, setSubscribedProducts] = useState<Set<ProductId>>(new Set());
  const [orderBooks, setOrderBooks] = useState<Map<ProductId, OrderBookSnapshot>>(new Map());
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [channels, setChannels] = useState<ChannelEntry[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    const onConnect = (): void => setConnected(true);
    const onDisconnect = (): void => setConnected(false);

    const onOrderBookUpdate = (data: OrderBookSnapshot): void => {
      setOrderBooks((prev) => {
        const next = new Map(prev);
        next.set(data.productId as ProductId, data);
        return next;
      });
    };

    const onMatch = (data: MatchData): void => {
      setMatches((prev) => [data, ...prev].slice(0, MAX_MATCHES));
    };

    const onSubscriptionsUpdate = (ch: ChannelEntry[]): void => {
      setChannels(ch);
    };

    const onSubscriptionStatus = (data: { productId: string; subscribed: boolean }): void => {
      const product = data.productId as ProductId;
      setSubscribedProducts((prev) => {
        const next = new Set(prev);
        if (data.subscribed) {
          next.add(product);
        } else {
          next.delete(product);
          // Remove stale order book data when user unsubscribes.
          setOrderBooks((books) => {
            const updated = new Map(books);
            updated.delete(product);
            return updated;
          });
        }
        return next;
      });
    };

    const onServerError = (msg: string): void => {
      setServerError(msg);
      setTimeout(() => setServerError(null), 5000);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('orderbook_update', onOrderBookUpdate);
    socket.on('match', onMatch);
    socket.on('subscriptions_update', onSubscriptionsUpdate);
    socket.on('subscription_status', onSubscriptionStatus);
    socket.on('server_error', onServerError);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('orderbook_update', onOrderBookUpdate);
      socket.off('match', onMatch);
      socket.off('subscriptions_update', onSubscriptionsUpdate);
      socket.off('subscription_status', onSubscriptionStatus);
      socket.off('server_error', onServerError);
    };
  }, []);

  const subscribe = useCallback((productId: ProductId): void => {
    socket.emit('subscribe', productId);
  }, []);

  const unsubscribe = useCallback((productId: ProductId): void => {
    socket.emit('unsubscribe', productId);
  }, []);

  return {
    connected,
    subscribedProducts,
    orderBooks,
    matches,
    channels,
    serverError,
    subscribe,
    unsubscribe,
  };
}
