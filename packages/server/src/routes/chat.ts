import { Hono } from 'hono';
import { db } from '../db/index.js';
import { messages, conversations, cells } from '../db/schema.js';
import { eq, desc, and } from 'drizzle-orm';
import { broadcast } from '../lib/websocket.js';

const chatRoutes = new Hono();

// List conversations
chatRoutes.get('/conversations', async (c) => {
  const userId = c.get('userId' as never) as string;
  const convos = await db.select({
    id: conversations.id,
    cellId: conversations.cellId,
    cellName: cells.name,
    createdAt: conversations.createdAt,
  })
    .from(conversations)
    .leftJoin(cells, eq(conversations.cellId, cells.id))
    .where(eq(conversations.userId, userId))
    .orderBy(desc(conversations.createdAt));

  return c.json({ success: true, data: convos });
});

// Get messages for a conversation
chatRoutes.get('/conversations/:id/messages', async (c) => {
  const conversationId = c.req.param('id');
  const limit = parseInt(c.req.query('limit') || '50');
  const before = c.req.query('before'); // cursor-based pagination

  let query = db.select().from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.createdAt))
    .limit(limit);

  const msgs = await query;
  return c.json({ success: true, data: msgs.reverse() }); // Return in chronological order
});

// Send a message (triggers agent processing)
chatRoutes.post('/conversations/:id/messages', async (c) => {
  const userId = c.get('userId' as never) as string;
  const conversationId = c.req.param('id');
  const { content } = await c.req.json();

  if (!content?.trim()) {
    return c.json({ success: false, error: 'Message content required' }, 400);
  }

  // Save user message
  const [userMsg] = await db.insert(messages).values({
    conversationId,
    role: 'user',
    content: content.trim(),
  }).returning();

  // Broadcast to other clients
  broadcast(userId, {
    type: 'message',
    payload: userMsg,
  });

  // TODO: Trigger agent conductor here (Phase 2)
  // For now, echo back a placeholder
  const [aiMsg] = await db.insert(messages).values({
    conversationId,
    role: 'assistant',
    content: `[Agent not yet active] Received: "${content.trim().substring(0, 50)}"`,
  }).returning();

  broadcast(userId, {
    type: 'message',
    payload: aiMsg,
  });

  return c.json({ success: true, data: { userMessage: userMsg, aiMessage: aiMsg } });
});

export default chatRoutes;
