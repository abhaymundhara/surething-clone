import { db } from '../db/index.js';
import { cells, cellState } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';

// ═══════════════════════════════════════════════════════
// CELL VIRTUAL FILESYSTEM
// Each cell has a virtual filesystem namespace:
// /cells/{cellId}/CELL.md, META/STATE.md, META/HEARTBEAT.md,
// META/HEARTBEAT_STATE.json, skills/, workspace/, drafts/
// ═══════════════════════════════════════════════════════

export interface CellFile {
  path: string;
  content: string;
  updatedAt: Date;
}

// Read a file from the cell's virtual filesystem
export async function readCellFile(cellId: string, path: string): Promise<CellFile | null> {
  // Map virtual paths to DB queries
  if (path === 'CELL.md') {
    const [cell] = await db.select().from(cells).where(eq(cells.id, cellId));
    if (!cell) return null;
    return {
      path,
      content: `---\ncell_id: ${cell.id}\nname: ${cell.name}\nstatus: ${cell.status}\nfingerprint: ${cell.fingerprint || ''}\ncreated_at: ${cell.createdAt}\nlast_seen_at: ${cell.lastSeenAt}\n---`,
      updatedAt: cell.lastSeenAt,
    };
  }

  if (path === 'META/STATE.md') {
    const states = await db.select().from(cellState)
      .where(and(eq(cellState.cellId, cellId), eq(cellState.layer, 'state')));
    if (states.length === 0) {
      // Build from L2-L6 layers
      const layers = await db.select().from(cellState).where(eq(cellState.cellId, cellId));
      const content = layers.map(l => `## ${l.layer}\n${l.content}`).join('\n\n');
      return { path, content, updatedAt: new Date() };
    }
    return { path, content: states[0].content, updatedAt: states[0].updatedAt };
  }

  if (path === 'META/HEARTBEAT.md') {
    const [hb] = await db.select().from(cellState)
      .where(and(eq(cellState.cellId, cellId), eq(cellState.layer, 'heartbeat')));
    return hb ? { path, content: hb.content, updatedAt: hb.updatedAt } : null;
  }

  if (path === 'META/HEARTBEAT_STATE.json') {
    const [hbs] = await db.select().from(cellState)
      .where(and(eq(cellState.cellId, cellId), eq(cellState.layer, 'heartbeat_state')));
    return hbs ? { path, content: hbs.content, updatedAt: hbs.updatedAt } : null;
  }

  return null;
}

// Write a file to the cell's virtual filesystem
export async function writeCellFile(cellId: string, path: string, content: string): Promise<void> {
  const layerMap: Record<string, string> = {
    'META/STATE.md': 'state',
    'META/HEARTBEAT.md': 'heartbeat',
    'META/HEARTBEAT_STATE.json': 'heartbeat_state',
  };

  const layer = layerMap[path];
  if (!layer) {
    console.warn(`[CellFS] Cannot write to path: ${path}`);
    return;
  }

  const existing = await db.select().from(cellState)
    .where(and(eq(cellState.cellId, cellId), eq(cellState.layer, layer)));

  if (existing.length > 0) {
    await db.update(cellState)
      .set({ content, updatedAt: new Date() })
      .where(and(eq(cellState.cellId, cellId), eq(cellState.layer, layer)));
  } else {
    await db.insert(cellState).values({ cellId, layer, content });
  }
}

// Initialize a new cell with default files
export async function initializeCellFilesystem(cellId: string): Promise<void> {
  console.log(`[CellFS] Initializing filesystem for cell ${cellId}`);
  // Cell state layers will be created on first compression
  // Heartbeat config can be set later by the user or agent
}
