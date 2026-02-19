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
import webhookRoutes from './connectors/github/webhooks.js';
import { addConnection, removeConnection } from './lib/websocket.js';
import { ensureBucket } from './lib/file-store.js';
import { healthCheck as llmHealthCheck } from './lib/llm.js';
import { initializeSkills } from './agent/skills.js';
import { initializeScheduler, restoreScheduledTasks } from './agent/scheduler.js';
import { runConductor, type Signal } from './agent/conductor.js';

const app = new Hono();
const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

// ─── Global Middleware ────────────────────────────────────
app.use('*', cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:1420',
  credentials: true,
}));
app.use('*', logger());

// Auth middleware — skip for public routes
app.use('/api/*', async (c, next) => {
  // Skip auth for public endpoints
  const path = c.req.path;
  if (path === '/api/health' || 
      path === '/api/auth/login' || 
      path === '/api/auth/register' ||
      path.startsWith('/api/webhooks/') ||
      path === '/api/connections/github/callback') {
    return next();
  }
  return authMiddleware(c, next);
});

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
app.route('/api/webhooks', webhookRoutes);

// ─── WebSocket ────────────────────────────────────────────
app.get('/api/ws', upgradeWebSocket((c) => {
  let userId: string = '';

  return {
    onOpen(evt, ws) {
      console.log('[WS] New connection opened');
    },
    onMessage(evt, ws) {
      try {
        const data = JSON.parse(evt.data.toString());

        // Auth message
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

        if (!userId) {
          ws.send(JSON.stringify({ type: 'error', message: 'Not authenticated' }));
          return;
        }

        // Chat message via WebSocket
        if (data.type === 'message' && data.content) {
          const signal: Signal = {
            type: 'chat_message',
            userId,
            cellId: data.cellId,
            conversationId: data.conversationId,
            content: data.content,
          };

          runConductor(signal).then((result) => {
            ws.send(JSON.stringify({
              type: 'response',
              payload: result,
            }));
          }).catch((e) => {
            ws.send(JSON.stringify({
              type: 'error',
              message: (e as Error).message,
            }));
          });
          return;
        }

        ws.send(JSON.stringify({ type: 'ack', id: data.id }));
      } catch (e) {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
      }
    },
    onClose() {
      if (userId) removeConnection(userId);
      console.log('[WS] Connection closed');
    },
  };
}));

// ─── Start Server ─────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '3001');

async function start() {
  // Initialize file storage
  await ensureBucket();

  // Initialize agent skills (GitHub tools, etc.)
  initializeSkills();

  // Initialize task scheduler (BullMQ workers)
  initializeScheduler();

  // Restore scheduled cron tasks
  await restoreScheduledTasks();

  const server = serve({ fetch: app.fetch, port: PORT }, (info) => {
    console.log(`\n🧠 SureThing Clone server running on http://localhost:${info.port}`);
    console.log('   Agent core: ✅ Conductor + Tools + Memory');
    console.log('   GitHub:     ✅ 12 tools registered');
    console.log('   Scheduler:  ✅ BullMQ workers active');
    console.log('   WebSocket:  ✅ Real-time chat ready\n');
  });

  injectWebSocket(server);
}

start().catch((e) => {
  console.error('Failed to start server:', e);
  process.exit(1);
});
