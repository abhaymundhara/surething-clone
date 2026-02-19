import { db } from '../db/index.js';
import { workspaceFiles } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';

// ═══════════════════════════════════════════════════════
// WORKSPACE FILE MANAGER
// Persistent storage for task action plans, scripts,
// config, and context. Referenced by scheduled tasks.
// ═══════════════════════════════════════════════════════

export async function readWorkspaceFile(cellId: string, path: string): Promise<string | null> {
  const [file] = await db.select().from(workspaceFiles)
    .where(and(eq(workspaceFiles.cellId, cellId), eq(workspaceFiles.path, path)));
  return file?.content || null;
}

export async function writeWorkspaceFile(cellId: string, path: string, content: string): Promise<void> {
  const existing = await db.select().from(workspaceFiles)
    .where(and(eq(workspaceFiles.cellId, cellId), eq(workspaceFiles.path, path)));

  if (existing.length > 0) {
    await db.update(workspaceFiles)
      .set({ content, updatedAt: new Date() })
      .where(and(eq(workspaceFiles.cellId, cellId), eq(workspaceFiles.path, path)));
  } else {
    await db.insert(workspaceFiles).values({ cellId, path, content });
  }
}

export async function listWorkspaceFiles(cellId: string): Promise<{ path: string; updatedAt: Date }[]> {
  const files = await db.select({ path: workspaceFiles.path, updatedAt: workspaceFiles.updatedAt })
    .from(workspaceFiles)
    .where(eq(workspaceFiles.cellId, cellId));
  return files;
}

export async function deleteWorkspaceFile(cellId: string, path: string): Promise<void> {
  await db.delete(workspaceFiles)
    .where(and(eq(workspaceFiles.cellId, cellId), eq(workspaceFiles.path, path)));
}
