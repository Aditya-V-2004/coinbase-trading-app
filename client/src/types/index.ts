export type ProductId = 'BTC-USD' | 'ETH-USD' | 'XRP-USD' | 'LTC-USD';

export const SUPPORTED_PRODUCTS: ProductId[] = [
  'BTC-USD',
  'ETH-USD',
  'XRP-USD',
  'LTC-USD',
];

export interface OrderBookLevel {
  price: string;
  size: string;
}

export interface OrderBookSnapshot {
  productId: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  timestamp: number;
}

export interface MatchData {
  tradeId: number;
  time: string;
  productId: string;
  size: string;
  price: string;
  side: 'buy' | 'sell';
}

export interface ChannelEntry {
  name: string;
  product_ids: string[];
}

// ─── Socket.io event maps ─────────────────────────────────────────────────────

export interface ServerToClientEvents {
  orderbook_update: (data: OrderBookSnapshot) => void;
  match: (data: MatchData) => void;
  subscriptions_update: (channels: ChannelEntry[]) => void;
  subscription_status: (data: { productId: string; subscribed: boolean }) => void;
  server_error: (message: string) => void;
}

export interface ClientToServerEvents {
  subscribe: (productId: string) => void;
  unsubscribe: (productId: string) => void;
}
