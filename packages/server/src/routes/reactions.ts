import { Hono } from 'hono';
import { db } from '../db/index.js';
import { messages } from '../db/schema.js';
import { eq } from 'drizzle-orm';

const reactionRoutes = new Hono();

const VALID_REACTIONS = ['thumbs_up', 'thumbs_down', 'heart', 'smile', 'thinking', 'celebrate', 'clap', 'sad', 'fire', 'pray'];

reactionRoutes.post('/:messageId/reactions', async (c) => {
  const userId = c.get('userId' as never) as string;
  const messageId = c.req.param('messageId');
  const { emoji } = await c.req.json();

  if (!VALID_REACTIONS.includes(emoji)) {
    return c.json({ success: false, error: `Invalid reaction. Valid: ${VALID_REACTIONS.join(', ')}` }, 400);
  }

  const [msg] = await db.select().from(messages).where(eq(messages.id, messageId));
  if (!msg) return c.json({ success: false, error: 'Message not found' }, 404);

  const reactions = (msg.reactions as any[] || []);
  // Toggle: remove if exists, add if not
  const existingIdx = reactions.findIndex((r: any) => r.emoji === emoji && r.userId === userId);
  if (existingIdx >= 0) {
    reactions.splice(existingIdx, 1);
  } else {
    reactions.push({ emoji, userId, timestamp: new Date().toISOString() });
  }

  await db.update(messages).set({ reactions }).where(eq(messages.id, messageId));
  return c.json({ success: true, data: { reactions } });
});

export default reactionRoutes;
