import { Hono } from 'hono';
import { db } from '../db/index.js';
import { cells, cellState, conversations } from '../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';

const cellRoutes = new Hono();

// List all cells for the current user
cellRoutes.get('/', async (c) => {
  const userId = c.get('userId' as never) as string;
  const userCells = await db.select().from(cells)
    .where(eq(cells.userId, userId))
    .orderBy(desc(cells.lastSeenAt));
  return c.json({ success: true, data: userCells });
});

// Get cell with state
cellRoutes.get('/:id', async (c) => {
  const userId = c.get('userId' as never) as string;
  const cellId = c.req.param('id');

  const [cell] = await db.select().from(cells)
    .where(and(eq(cells.id, cellId), eq(cells.userId, userId)))
    .limit(1);
  if (!cell) return c.json({ success: false, error: 'Cell not found' }, 404);

  const states = await db.select().from(cellState).where(eq(cellState.cellId, cellId));
  const stateMap: Record<string, string> = {};
  for (const s of states) {
    stateMap[s.layer] = s.content;
  }

  return c.json({ success: true, data: { ...cell, state: stateMap } });
});

// Create a new cell
cellRoutes.post('/', async (c) => {
  const userId = c.get('userId' as never) as string;
  const { name, fingerprint } = await c.req.json();

  const [cell] = await db.insert(cells).values({
    userId,
    name: name || 'New Cell',
    fingerprint: fingerprint || null,
  }).returning();

  // Create a default conversation for this cell
  await db.insert(conversations).values({
    cellId: cell.id,
    userId,
  });

  return c.json({ success: true, data: cell }, 201);
});

// Update cell
cellRoutes.patch('/:id', async (c) => {
  const userId = c.get('userId' as never) as string;
  const cellId = c.req.param('id');
  const updates = await c.req.json();

  const [updated] = await db.update(cells)
    .set({ ...updates, lastSeenAt: new Date() })
    .where(and(eq(cells.id, cellId), eq(cells.userId, userId)))
    .returning();

  if (!updated) return c.json({ success: false, error: 'Cell not found' }, 404);
  return c.json({ success: true, data: updated });
});

export default cellRoutes;
