import { Hono } from 'hono';
import { db } from '../db/index.js';
import { messages, conversations, cells } from '../db/schema.js';
import { eq, desc, and } from 'drizzle-orm';
import { broadcast } from '../lib/websocket.js';
import { runConductor, type Signal } from '../agent/conductor.js';

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

  const msgs = await db.select().from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.createdAt))
    .limit(limit);

  return c.json({ success: true, data: msgs.reverse() });
});

// Send a message → triggers the agent conductor
chatRoutes.post('/conversations/:id/messages', async (c) => {
  const userId = c.get('userId' as never) as string;
  const conversationId = c.req.param('id');
  const { content } = await c.req.json();

  if (!content?.trim()) {
    return c.json({ success: false, error: 'Message content required' }, 400);
  }

  // Get the conversation's cell
  const [conv] = await db.select().from(conversations)
    .where(eq(conversations.id, conversationId));

  if (!conv) {
    return c.json({ success: false, error: 'Conversation not found' }, 404);
  }

  // Run through the conductor
  try {
    const signal: Signal = {
      type: 'chat_message',
      userId,
      cellId: conv.cellId,
      conversationId,
      content: content.trim(),
    };

    const result = await runConductor(signal);

    return c.json({
      success: true,
      data: {
        response: result.response,
        cellId: result.cellId,
        conversationId: result.conversationId,
        toolsUsed: result.toolsUsed,
      },
    });
  } catch (e) {
    console.error('[Chat] Conductor error:', (e as Error).message);
    return c.json({ success: false, error: 'Agent processing failed' }, 500);
  }
});

// Create a new conversation
chatRoutes.post('/conversations', async (c) => {
  const userId = c.get('userId' as never) as string;
  const { cellId, cellName } = await c.req.json();

  let targetCellId = cellId;

  // Create cell if needed
  if (!targetCellId) {
    const [cell] = await db.insert(cells).values({
      userId,
      name: cellName || 'New Conversation',
      status: 'active',
    }).returning();
    targetCellId = cell.id;
  }

  const [conv] = await db.insert(conversations).values({
    cellId: targetCellId,
    userId,
  }).returning();

  return c.json({ success: true, data: { conversation: conv, cellId: targetCellId } }, 201);
});

export default chatRoutes;
