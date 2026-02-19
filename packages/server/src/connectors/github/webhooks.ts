import { Hono } from 'hono';
import { runConductor, type Signal } from '../../agent/conductor.js';
import { db } from '../../db/index.js';
import { connections, cells } from '../../db/schema.js';
import { eq, and } from 'drizzle-orm';

// ═══════════════════════════════════════════════════════
// GITHUB WEBHOOKS — React to push, PR, issue events
// ═══════════════════════════════════════════════════════

const webhookRoutes = new Hono();

webhookRoutes.post('/github', async (c) => {
  const event = c.req.header('X-GitHub-Event');
  const payload = await c.req.json();

  console.log(`[Webhook] GitHub event: ${event}`);

  // Find the user who owns this GitHub connection
  const repoOwner = payload.repository?.owner?.login;
  if (!repoOwner) return c.json({ ok: true });

  const conn = await db.select().from(connections)
    .where(and(
      eq(connections.provider, 'github'),
      eq(connections.status, 'active'),
    ));

  if (conn.length === 0) return c.json({ ok: true });
  const userId = conn[0].userId;

  // Build signal content based on event type
  let content = '';
  let cellName = `GitHub: ${payload.repository?.full_name || 'unknown'}`;

  switch (event) {
    case 'push':
      const commits = payload.commits?.length || 0;
      const branch = payload.ref?.replace('refs/heads/', '');
      content = `New push to ${payload.repository.full_name}/${branch}: ${commits} commit(s). Latest: "${payload.head_commit?.message}"`;
      break;

    case 'pull_request':
      content = `PR ${payload.action}: #${payload.pull_request.number} "${payload.pull_request.title}" by ${payload.pull_request.user.login} in ${payload.repository.full_name}`;
      break;

    case 'issues':
      content = `Issue ${payload.action}: #${payload.issue.number} "${payload.issue.title}" in ${payload.repository.full_name}`;
      break;

    case 'issue_comment':
      content = `Comment on #${payload.issue.number} "${payload.issue.title}" by ${payload.comment.user.login}: "${payload.comment.body.substring(0, 200)}"`;
      break;

    case 'workflow_run':
      content = `Workflow "${payload.workflow_run.name}" ${payload.workflow_run.conclusion} on ${payload.repository.full_name}/${payload.workflow_run.head_branch}`;
      break;

    default:
      return c.json({ ok: true }); // Unhandled event
  }

  // Find or create a cell for this repo
  const existingCells = await db.select().from(cells)
    .where(and(eq(cells.userId, userId), eq(cells.name, cellName)));

  let cellId: string;
  if (existingCells.length > 0) {
    cellId = existingCells[0].id;
  } else {
    const [newCell] = await db.insert(cells).values({
      userId,
      name: cellName,
      fingerprint: `github:${payload.repository.full_name}`,
      status: 'active',
    }).returning();
    cellId = newCell.id;
  }

  // Run through conductor
  const signal: Signal = {
    type: 'event',
    userId,
    cellId,
    content: `[GitHub Event] ${content}`,
  };

  try {
    await runConductor(signal);
  } catch (e) {
    console.error('[Webhook] Conductor failed:', (e as Error).message);
  }

  return c.json({ ok: true });
});

export default webhookRoutes;
