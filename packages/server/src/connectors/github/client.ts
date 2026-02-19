import { Octokit } from 'octokit';
import { db } from '../../db/index.js';
import { connections } from '../../db/schema.js';
import { eq, and } from 'drizzle-orm';

// ═══════════════════════════════════════════════════════
// GITHUB CLIENT — Octokit wrapper with token management
// ═══════════════════════════════════════════════════════

export async function getGitHubClient(userId: string): Promise<Octokit> {
  const [conn] = await db.select().from(connections)
    .where(and(eq(connections.userId, userId), eq(connections.provider, 'github'), eq(connections.status, 'active')));

  if (!conn) {
    throw new Error('GitHub not connected. Please connect your GitHub account first.');
  }

  return new Octokit({ auth: conn.accessToken });
}

export async function isGitHubConnected(userId: string): Promise<boolean> {
  const [conn] = await db.select().from(connections)
    .where(and(eq(connections.userId, userId), eq(connections.provider, 'github'), eq(connections.status, 'active')));
  return !!conn;
}
