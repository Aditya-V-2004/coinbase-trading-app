# Coinbase Trading Server

Node.js + TypeScript WebSocket server that proxies the [Coinbase Exchange public feed](https://docs.cdp.coinbase.com/exchange/websocket-feed/overview) and distributes real-time order book and trade data to connected browser clients over Socket.io.

## Architecture

```
Browser clients (Socket.io)
        │
        ▼
┌──────────────────┐
│  Express / HTTP  │  ← /health endpoint
│  Socket.io       │  ← fan-out to subscribed clients
│  SocketHandler   │  ← per-product subscription tracking + push loop
│  OrderBook       │  ← level-2 state per product
│  CoinbaseService │  ← single WS connection to Coinbase
└──────────────────┘
        │
        ▼
wss://ws-feed.exchange.coinbase.com
```

Key design decisions:

| Concern | Approach |
|---|---|
| Coinbase WS connection | One shared connection; auto-reconnects on drop |
| Order book | Maintained server-side; clients receive depth-limited snapshots |
| Push rate | Configurable interval (default 50 ms) via `setInterval` |
| Fan-out | Socket.io rooms — one room per `ProductId` |
| Multi-user isolation | Each socket joins/leaves product rooms independently |
| Coinbase unsubscribe | Sent only when the last subscriber leaves a product |

## Prerequisites

- Node.js ≥ 18
- npm ≥ 9

## Setup

```bash
cd server
npm install
cp .env.example .env   # edit as needed
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | HTTP / Socket.io listening port |
| `COINBASE_WS_URL` | `wss://ws-feed.exchange.coinbase.com` | Coinbase Exchange WebSocket URL |
| `COINBASE_RECONNECT_DELAY_MS` | `5000` | Delay before reconnecting to Coinbase |
| `CLIENT_ORIGIN` | `http://localhost:5173` | CORS origin for the React client |
| `PUSH_INTERVAL_MS` | `50` | Order book snapshot push interval in ms |
| `ORDER_BOOK_DEPTH` | `20` | Number of price levels per side in each snapshot |

## Running

```bash
# Development (hot-reload)
npm run dev

# Production
npm run build
npm start
```

## Testing

```bash
npm test              # run all tests
npm run test:coverage # with coverage report
```

Tests cover:

- `OrderBook` — snapshot initialisation, incremental updates, level removal, depth limit, sort order
- `CoinbaseService` — message routing, subscribe/unsubscribe wire format, reconnection logic, error handling
- `SocketHandler` — subscription lifecycle, Coinbase subscribe/unsubscribe gating, room-based fan-out, disconnect cleanup

## Socket.io Events

### Server → Client

| Event | Payload | Description |
|---|---|---|
| `orderbook_update` | `OrderBookSnapshot` | Depth-limited bids/asks at the push interval |
| `match` | `MatchData` | Individual trade (buy or sell) |
| `subscriptions_update` | `ChannelEntry[]` | Current Coinbase channel subscriptions |
| `subscription_status` | `{ productId, subscribed }` | Confirmation of the client's subscribe/unsubscribe |
| `server_error` | `string` | Error message |

### Client → Server

| Event | Payload | Description |
|---|---|---|
| `subscribe` | `productId: string` | Subscribe to a product |
| `unsubscribe` | `productId: string` | Unsubscribe from a product |

## Health Check

```
GET /health
```

Returns `{ "status": "ok", "timestamp": "..." }`.
