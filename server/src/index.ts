import 'dotenv/config';
import http from 'http';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import { CoinbaseService } from './coinbaseService';
import { OrderBookPoller } from './orderBookPoller';
import { SocketHandler } from './socketHandler';
import { ServerToClientEvents, ClientToServerEvents } from './types';

const PORT = parseInt(process.env.PORT ?? '3001', 10);
const COINBASE_WS_URL = process.env.COINBASE_WS_URL ?? 'wss://ws-feed.exchange.coinbase.com';
const COINBASE_REST_URL = process.env.COINBASE_REST_URL ?? 'https://api.exchange.coinbase.com';
const COINBASE_RECONNECT_DELAY_MS = parseInt(process.env.COINBASE_RECONNECT_DELAY_MS ?? '5000', 10);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173';
const PUSH_INTERVAL_MS = parseInt(process.env.PUSH_INTERVAL_MS ?? '50', 10);
const ORDER_BOOK_DEPTH = parseInt(process.env.ORDER_BOOK_DEPTH ?? '20', 10);
const ORDER_BOOK_POLL_INTERVAL_MS = parseInt(process.env.ORDER_BOOK_POLL_INTERVAL_MS ?? '1000', 10);

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const httpServer = http.createServer(app);

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: CLIENT_ORIGIN, methods: ['GET', 'POST'] },
  pingInterval: 10_000,
  pingTimeout: 5_000,
});

// WS connection to Coinbase — used for the matches (trades) channel only.
// The level2 channel now requires auth on the Exchange API.
const coinbaseService = new CoinbaseService(COINBASE_WS_URL, COINBASE_RECONNECT_DELAY_MS);
coinbaseService.connect();

// REST poller for public order book snapshots.
const bookPoller = new OrderBookPoller(COINBASE_REST_URL, ORDER_BOOK_POLL_INTERVAL_MS);

const socketHandler = new SocketHandler(
  io,
  coinbaseService,
  bookPoller,
  PUSH_INTERVAL_MS,
  ORDER_BOOK_DEPTH
);

httpServer.listen(PORT, () => {
  console.log(`[Server] Listening on port ${PORT}`);
  console.log(`[Server] Coinbase WS feed: ${COINBASE_WS_URL}`);
  console.log(`[Server] Coinbase REST: ${COINBASE_REST_URL}`);
  console.log(`[Server] Order book poll interval: ${ORDER_BOOK_POLL_INTERVAL_MS}ms`);
  console.log(`[Server] Order book push interval: ${PUSH_INTERVAL_MS}ms`);
});

const shutdown = (): void => {
  console.log('[Server] Shutting down gracefully...');
  socketHandler.cleanup();
  coinbaseService.disconnect();
  httpServer.close(() => {
    console.log('[Server] HTTP server closed.');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
