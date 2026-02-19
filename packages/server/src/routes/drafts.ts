import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db/index.js';
import { drafts } from '../db/schema.js';
import { eq } from 'drizzle-orm';

const draftRoutes = new Hono();

// Get draft
draftRoutes.get('/:id', async (c) => {
  const draftId = c.req.param('id');
  const [draft] = await db.select().from(drafts).where(eq(drafts.id, draftId)).limit(1);
  if (!draft) return c.json({ success: false, error: 'Draft not found' }, 404);
  return c.json({ success: true, data: draft });
});

// Create draft
draftRoutes.post('/', async (c) => {
  const userId = c.get('userId' as never) as string;
  const { cellId, draftType, content } = await c.req.json();

  const [draft] = await db.insert(drafts).values({
    cellId,
    userId,
    draftType: draftType || 'generic',
    content: content || {},
  }).returning();

  return c.json({ success: true, data: draft }, 201);
});

// Update draft
draftRoutes.patch('/:id', async (c) => {
  const draftId = c.req.param('id');
  const updates = await c.req.json();

  const [updated] = await db.update(drafts)
    .set(updates)
    .where(eq(drafts.id, draftId))
    .returning();

  if (!updated) return c.json({ success: false, error: 'Draft not found' }, 404);
  return c.json({ success: true, data: updated });
});

export default draftRoutes;
