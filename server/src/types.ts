export type ProductId = 'BTC-USD' | 'ETH-USD' | 'XRP-USD' | 'LTC-USD';

export const SUPPORTED_PRODUCTS: ProductId[] = [
  'BTC-USD',
  'ETH-USD',
  'XRP-USD',
  'LTC-USD',
];

export const ORDERBOOK_CHANNELS = ['level2'] as const;
export const TRADE_CHANNELS = ['matches'] as const;
export const ALL_CHANNELS = [...ORDERBOOK_CHANNELS, ...TRADE_CHANNELS] as const;

// ─── Coinbase WebSocket message shapes ───────────────────────────────────────

export interface CoinbaseSubscribeRequest {
  type: 'subscribe' | 'unsubscribe';
  product_ids: string[];
  channels: string[];
}

export interface CoinbaseSubscriptionsMessage {
  type: 'subscriptions';
  channels: Array<{
    name: string;
    product_ids: string[];
  }>;
}

export interface CoinbaseSnapshotMessage {
  type: 'snapshot';
  product_id: string;
  bids: [string, string][]; // [price, size]
  asks: [string, string][]; // [price, size]
}

export interface CoinbaseL2UpdateMessage {
  type: 'l2update';
  product_id: string;
  time: string;
  changes: [string, string, string][]; // [side, price, size]
}

export interface CoinbaseMatchMessage {
  type: 'match' | 'last_match';
  trade_id: number;
  sequence: number;
  maker_order_id: string;
  taker_order_id: string;
  time: string;
  product_id: string;
  size: string;
  price: string;
  side: 'buy' | 'sell';
}

export interface CoinbaseErrorMessage {
  type: 'error';
  message: string;
  reason?: string;
}

export type CoinbaseInboundMessage =
  | CoinbaseSubscriptionsMessage
  | CoinbaseSnapshotMessage
  | CoinbaseL2UpdateMessage
  | CoinbaseMatchMessage
  | CoinbaseErrorMessage;

// ─── Shared client/server data shapes ────────────────────────────────────────

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

export type ChannelEntry = {
  name: string;
  product_ids: string[];
};

// ─── Socket.io typed event maps ───────────────────────────────────────────────

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
