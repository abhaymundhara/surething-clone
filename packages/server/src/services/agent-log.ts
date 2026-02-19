import { db } from '../db/index.js';
import { agentRuns } from '../db/schema.js';
import { eq, desc, and, gte, lte, sql } from 'drizzle-orm';

// ═══════════════════════════════════════════════════════
// AGENT ACTIVITY LOGGING
// Tracks every action the agent takes for debugging,
// auditing, and transparency
// ═══════════════════════════════════════════════════════

export type AgentAction =
  | 'chat_response'        // Agent responded to chat
  | 'tool_execution'       // Agent called a tool
  | 'task_created'         // Agent created a task
  | 'task_completed'       // Task completed
  | 'draft_created'        // Draft created for HITL
  | 'memory_saved'         // User memory saved
  | 'memory_compressed'    // Cell state compressed
  | 'heartbeat_check'      // Heartbeat rule executed
  | 'heartbeat_silent'     // Heartbeat ran but nothing to report
  | 'webhook_received'     // GitHub webhook processed
  | 'schedule_triggered'   // Scheduled task fired
  | 'error'                // Error occurred
  ;

export async function logAgentAction(
  userId: string,
  cellId: string | null,
  action: AgentAction,
  details: Record<string, unknown> = {},
  batchId?: string,
): Promise<void> {
  await db.insert(agentRuns).values({
    userId,
    cellId,
    action,
    details,
    batchId: batchId || crypto.randomUUID(),
  });
}

export async function searchAgentRuns(filters: {
  userId?: string;
  action?: string;
  cellId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}) {
  const conditions = [];
  if (filters.userId) conditions.push(eq(agentRuns.userId, filters.userId));
  if (filters.action) conditions.push(eq(agentRuns.action, filters.action));
  if (filters.cellId) conditions.push(eq(agentRuns.cellId, filters.cellId));
  if (filters.startDate) conditions.push(gte(agentRuns.createdAt, filters.startDate));
  if (filters.endDate) conditions.push(lte(agentRuns.createdAt, filters.endDate));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  return db.select().from(agentRuns)
    .where(where)
    .orderBy(desc(agentRuns.createdAt))
    .limit(filters.limit || 50);
}
