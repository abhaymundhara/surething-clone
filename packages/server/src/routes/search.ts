import { Hono } from 'hono';
import { searchSimilar } from '../lib/embeddings.js';
import { db } from '../db/index.js';
import { messages } from '../db/schema.js';
import { sql } from 'drizzle-orm';

const searchRoutes = new Hono();

// Semantic search across conversation history
searchRoutes.get('/', async (c) => {
  const userId = c.get('userId' as never) as string;
  const query = c.req.query('q');
  const limit = parseInt(c.req.query('limit') || '10');
  const conversationId = c.req.query('conversationId');

  if (!query) return c.json({ success: false, error: 'Query required' }, 400);

  const results = await searchSimilar(query, limit, conversationId || undefined);

  if (results.length === 0) {
    return c.json({ success: true, data: [] });
  }

  const msgIds = results.map(r => r.messageId);
  const msgs = await db.select().from(messages).where(sql`${messages.id} = ANY(${msgIds})`);

  const enriched = results.map(r => {
    const msg = msgs.find(m => m.id === r.messageId);
    return {
      messageId: r.messageId,
      similarity: r.similarity,
      role: msg?.role,
      content: msg?.content,
      createdAt: msg?.createdAt,
      conversationId: msg?.conversationId,
    };
  });

  return c.json({ success: true, data: enriched });
});

export default searchRoutes;
