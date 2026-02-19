import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { createNodeWebSocket } from '@hono/node-ws';

import { authMiddleware } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import cellRoutes from './routes/cells.js';
import chatRoutes from './routes/chat.js';
import taskRoutes from './routes/tasks.js';
import fileRoutes from './routes/files.js';
import memoryRoutes from './routes/memories.js';
import connectionRoutes from './routes/connections.js';
import draftRoutes from './routes/drafts.js';
import { addConnection, removeConnection } from './lib/websocket.js';
import { ensureBucket } from './lib/file-store.js';
import { healthCheck as llmHealthCheck } from './lib/llm.js';

const app = new Hono();
const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

// ─── Global Middleware ────────────────────────────────────
app.use('*', cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:1420',
  credentials: true,
}));
app.use('*', logger());
app.use('/api/*', authMiddleware);

// ─── Health Check ─────────────────────────────────────────
app.get('/api/health', async (c) => {
  const llm = await llmHealthCheck();
  return c.json({
    success: true,
    data: {
      server: 'ok',
      llm,
      timestamp: new Date().toISOString(),
    },
  });
});

// ─── API Routes ───────────────────────────────────────────
app.route('/api/auth', authRoutes);
app.route('/api/cells', cellRoutes);
app.route('/api/chat', chatRoutes);
app.route('/api/tasks', taskRoutes);
app.route('/api/files', fileRoutes);
app.route('/api/memories', memoryRoutes);
app.route('/api/connections', connectionRoutes);
app.route('/api/drafts', draftRoutes);

// ─── WebSocket ────────────────────────────────────────────
app.get('/api/ws', upgradeWebSocket((c) => {
  let userId: string = '';

  return {
    onOpen(evt, ws) {
      // Auth will be handled on first message
      console.log('[WS] New connection opened');
    },
    onMessage(evt, ws) {
      try {
        const data = JSON.parse(evt.data.toString());

        // First message should be auth
        if (data.type === 'auth' && data.token) {
          import('./lib/auth.js').then(({ verifyToken }) => {
            verifyToken(data.token).then((payload) => {
              userId = payload.sub;
              addConnection(userId, ws);
              ws.send(JSON.stringify({ type: 'authenticated', userId }));
            }).catch(() => {
              ws.send(JSON.stringify({ type: 'error', message: 'Invalid token' }));
              ws.close();
            });
          });
          return;
        }

        // Handle other message types
        if (!userId) {
          ws.send(JSON.stringify({ type: 'error', message: 'Not authenticated' }));
          return;
        }

        // TODO: Route to agent conductor (Phase 2)
        ws.send(JSON.stringify({ type: 'ack', id: data.id }));
      } catch {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
      }
    },
    onClose() {
      if (userId) {
        removeConnection(userId, undefined as any); // Will be cleaned up
      }
    },
  };
}));

// ─── Start Server ─────────────────────────────────────────
const port = parseInt(process.env.PORT || '3001');

async function start() {
  // Ensure MinIO bucket exists
  try {
    await ensureBucket();
    console.log('[Server] MinIO bucket ready');
  } catch (e) {
    console.warn('[Server] MinIO not available (non-critical):', (e as Error).message);
  }

  const server = serve({ fetch: app.fetch, port }, (info) => {
    console.log(`[Server] Running on http://localhost:${info.port}`);
    console.log(`[Server] WebSocket: ws://localhost:${info.port}/api/ws`);
    console.log(`[Server] Health: http://localhost:${info.port}/api/health`);
  });

  injectWebSocket(server);
}

start().catch(console.error);

export default app;
