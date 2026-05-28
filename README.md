# Coinbase Exchange Live Trading Dashboard

A full-stack real-time trading dashboard that streams live order book and trade data from the [Coinbase Exchange WebSocket Feed](https://docs.cdp.coinbase.com/exchange/websocket-feed/overview).

## Features

- **Live Level-2 Order Book** — bids and asks refreshed at 50 ms for up to 4 products simultaneously
- **Trade Blotter** — every match from the `matches` channel displayed in real time, colour-coded by side
- **Per-User Subscriptions** — each browser session maintains its own product subscriptions; the server routes data only to interested clients
- **System Status** — mirrors the Coinbase-level channel subscription state in real time
- **Auto-Reconnect** — both the Coinbase WebSocket (server side) and the Socket.io connection (client side) reconnect automatically on drop

## Tech Stack

| Layer | Technology |
|---|---|
| Server runtime | Node.js 18+ |
| Server language | TypeScript |
| HTTP / Socket.io | Express + socket.io |
| Coinbase WebSocket | `ws` library |
| Client framework | React 18 + TypeScript |
| Client build tool | Vite |
| Real-time transport | Socket.io (client) |
| Server tests | Jest + ts-jest |
| Client tests | Vitest + React Testing Library |

## Project Structure

```
coinbase-trading-app/
├── server/                  # Node.js WebSocket proxy + Socket.io server
│   ├── src/
│   │   ├── types.ts         # Shared types & event maps
│   │   ├── orderBook.ts     # Level-2 order book state machine
│   │   ├── coinbaseService.ts  # Coinbase WS client (auto-reconnect)
│   │   ├── socketHandler.ts    # Socket.io ↔ Coinbase bridge
│   │   └── index.ts         # Express + Socket.io bootstrap
│   └── tests/               # Jest unit tests
├── client/                  # React SPA
│   └── src/
│       ├── types/           # Shared TypeScript types
│       ├── socket.ts        # Singleton Socket.io client
│       ├── hooks/
│       │   └── useSocket.ts # Centralised state + event subscriptions
│       └── components/
│           ├── Subscribe/   # Product subscription controls
│           ├── PriceView/   # Order book display
│           ├── MatchView/   # Trade blotter
│           └── SystemStatus/ # Coinbase channel status
└── package.json             # Root workspace scripts
```

## Quick Start

### 1. Install dependencies

```bash
npm run install:all
```

### 2. Configure environment

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

Edit the `.env` files if needed (defaults work for local development).

### 3. Start both services

```bash
npm run dev
```

- Server: `http://localhost:3001`
- Client: `http://localhost:5173`

Open `http://localhost:5173` in your browser, subscribe to one or more products, and data will start flowing immediately.

## Running Tests

```bash
npm test            # server + client tests
npm test --prefix server
npm test --prefix client
```

## Environment Variables

### Server (`server/.env`)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | Listening port |
| `COINBASE_WS_URL` | `wss://ws-feed.exchange.coinbase.com` | Coinbase public feed URL |
| `COINBASE_RECONNECT_DELAY_MS` | `5000` | Reconnect delay in ms |
| `CLIENT_ORIGIN` | `http://localhost:5173` | CORS allowed origin |
| `PUSH_INTERVAL_MS` | `50` | Order book push interval in ms |
| `ORDER_BOOK_DEPTH` | `20` | Price levels per side per snapshot |

### Client (`client/.env`)

| Variable | Default | Description |
|---|---|---|
| `VITE_SERVER_URL` | `http://localhost:3001` | Server base URL |
| `VITE_MAX_MATCHES` | `200` | Maximum trade blotter rows |
| `VITE_PORT` | `5173` | Vite dev server port |

## Supported Products

- `BTC-USD`
- `ETH-USD`
- `XRP-USD`
- `LTC-USD`

## Architecture Notes

### Server

The server maintains a **single shared WebSocket connection** to Coinbase. When the first client subscribes to a product, the server subscribes to the `level2` and `matches` channels for that product on Coinbase. When the last subscriber leaves, it unsubscribes and clears the order book.

Order book snapshots are pushed to all subscribed clients via **Socket.io rooms** at a configurable interval (default 50 ms). This decouples the Coinbase update rate from the client render rate and prevents flooding slow clients.

Matches are forwarded immediately to the relevant product room since they are low-frequency compared to order book updates.

### Client

All socket state is centralised in the `useSocket` hook, which is the single source of truth for the entire application. Components receive data via props and emit user actions back to the hook.

The match blotter is capped at `VITE_MAX_MATCHES` entries to prevent unbounded memory growth in long-running sessions.
