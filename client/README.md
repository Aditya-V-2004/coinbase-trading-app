# Coinbase Trading Client

React + TypeScript single-page application that connects to the trading server via Socket.io and displays live Coinbase Exchange data across four panels.

## Components

| Component | Description |
|---|---|
| **Subscribe / Unsubscribe** | Toggle subscriptions for each of the four products; shows live subscription status badges |
| **Price View** | Depth-limited order book (bids in green, asks in red) refreshed at the server push rate (50 ms by default) |
| **Match View** | Real-time trade blotter showing timestamp, product, side, size, and price; buy rows are green, sell rows are red |
| **System Status** | Reflects the Coinbase-level channel subscription state returned by the server; also shows the WebSocket connection indicator |

## Architecture

```
App
 └── useSocket (hook)        ← singleton Socket.io client + reactive state
      ├── Subscribe           ← emits subscribe / unsubscribe
      ├── PriceView           ← consumes orderBooks Map
      ├── MatchView           ← consumes matches array (capped at VITE_MAX_MATCHES)
      └── SystemStatus        ← consumes channels array from Coinbase
```

State update notes:

- `orderBooks` is updated on every `orderbook_update` event (server pushes at 50 ms intervals).
- `matches` are prepended and capped so the blotter never exceeds `VITE_MAX_MATCHES` entries.
- `subscribedProducts` is driven by `subscription_status` confirmations from the server.
- `channels` mirrors the Coinbase `subscriptions` response broadcast by the server.

## Prerequisites

- Node.js ≥ 18
- npm ≥ 9
- The trading server must be running (see `server/README.md`)

## Setup

```bash
cd client
npm install
cp .env.example .env   # edit VITE_SERVER_URL if the server runs on a different host/port
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `VITE_SERVER_URL` | `http://localhost:3001` | Trading server URL |
| `VITE_MAX_MATCHES` | `200` | Maximum entries to keep in the match blotter |
| `VITE_PORT` | `5173` | Vite dev server port |

## Running

```bash
# Development (hot-reload)
npm run dev

# Production build
npm run build
npm run preview
```

## Testing

```bash
npm test              # run all tests once
npm run test:watch    # watch mode
npm run test:coverage # with coverage report
```

Tests cover all four components using React Testing Library, verifying:

- Correct rendering of subscribed / unsubscribed states
- Buy/sell colour classes applied to match rows
- Filtering of match rows for unsubscribed products
- Empty-state and waiting-state messages
- Channel and product tag rendering in SystemStatus
