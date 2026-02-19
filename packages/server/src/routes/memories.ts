import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db/index.js';
import { userMemories } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';

const memoryRoutes = new Hono();

const createMemorySchema = z.object({
  category: z.enum(['profile', 'time_pref', 'comm_style', 'work_rule']),
  content: z.string().min(1),
});

// List memories
memoryRoutes.get('/', async (c) => {
  const userId = c.get('userId' as never) as string;
  const category = c.req.query('category');

  let memories;
  if (category) {
    memories = await db.select().from(userMemories)
      .where(and(eq(userMemories.userId, userId), eq(userMemories.category, category)));
  } else {
    memories = await db.select().from(userMemories)
      .where(eq(userMemories.userId, userId));
  }

  return c.json({ success: true, data: memories });
});

// Save memory
memoryRoutes.post('/', async (c) => {
  const userId = c.get('userId' as never) as string;
  const body = await c.req.json();
  const parsed = createMemorySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: parsed.error.message }, 400);
  }

  const [memory] = await db.insert(userMemories).values({
    userId,
    ...parsed.data,
  }).returning();

  return c.json({ success: true, data: memory }, 201);
});

// Delete memory
memoryRoutes.delete('/:id', async (c) => {
  const userId = c.get('userId' as never) as string;
  const memoryId = c.req.param('id');
  await db.delete(userMemories)
    .where(and(eq(userMemories.id, memoryId), eq(userMemories.userId, userId)));
  return c.json({ success: true });
});

export default memoryRoutes;
