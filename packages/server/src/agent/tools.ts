import type { LLMToolDef, LLMToolCall } from '../lib/llm.js';
import { db } from '../db/index.js';
import { cells, cellState, messages, conversations, tasks, drafts, userMemories, uploadedFiles, connections } from '../db/schema.js';
import { eq, desc, and, sql } from 'drizzle-orm';
import { searchSimilar } from '../lib/embeddings.js';

// ═══════════════════════════════════════════════════════
// TOOL REGISTRY — Functions the agent can call
// ═══════════════════════════════════════════════════════

export interface ToolContext {
  userId: string;
  cellId: string;
  conversationId: string;
}

type ToolHandler = (args: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>;

const toolRegistry = new Map<string, { handler: ToolHandler; def: LLMToolDef }>();

function registerTool(name: string, description: string, parameters: Record<string, unknown>, handler: ToolHandler) {
  toolRegistry.set(name, {
    handler,
    def: {
      type: 'function',
      function: { name, description, parameters },
    },
  });
}

// ─── Built-in Tools ──────────────────────────────────────

registerTool(
  'search_conversation',
  'Search conversation history using semantic similarity. Use when you need to find specific information from past messages.',
  {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'What to search for' },
      limit: { type: 'number', description: 'Max results (default 5)' },
    },
    required: ['query'],
  },
  async (args, ctx) => {
    const results = await searchSimilar(args.query as string, (args.limit as number) || 5, ctx.conversationId);
    if (results.length === 0) return { results: [], message: 'No relevant messages found' };

    const msgIds = results.map(r => r.messageId);
    const msgs = await db.select().from(messages).where(sql`${messages.id} = ANY(${msgIds})`);
    return { results: msgs.map(m => ({ role: m.role, content: m.content, createdAt: m.createdAt })) };
  }
);

registerTool(
  'list_tasks',
  'List tasks in the current cell. Optionally filter by status.',
  {
    type: 'object',
    properties: {
      status: { type: 'string', description: 'Filter by status: pending, completed, failed, etc.' },
    },
  },
  async (args, ctx) => {
    let where = eq(tasks.cellId, ctx.cellId);
    if (args.status) {
      where = and(where, eq(tasks.status, args.status as string))!;
    }
    const result = await db.select().from(tasks).where(where).orderBy(desc(tasks.createdAt)).limit(20);
    return { tasks: result.map(t => ({ id: t.id, title: t.title, status: t.status, executor: t.executor })) };
  }
);

registerTool(
  'create_task',
  'Create a new task. Use for scheduling follow-ups, reminders, or creating HITL approval tasks.',
  {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Task title' },
      executor: { type: 'string', enum: ['ai', 'human'], description: 'Who executes this task' },
      action: { type: 'string', description: 'Instructions for AI tasks' },
      whyHuman: { type: 'string', description: 'Why human review is needed' },
      triggerType: { type: 'string', enum: ['delay', 'cron'], description: 'Scheduling type' },
      triggerConfig: { type: 'object', description: 'Schedule config' },
    },
    required: ['title', 'executor'],
  },
  async (args, ctx) => {
    const [task] = await db.insert(tasks).values({
      cellId: ctx.cellId,
      conversationId: ctx.conversationId,
      title: args.title as string,
      executor: args.executor as string,
      action: args.action as string || null,
      whyHuman: args.whyHuman as string || null,
      triggerType: args.triggerType as string || null,
      triggerConfig: args.triggerConfig || null,
    }).returning();
    return { task: { id: task.id, title: task.title, status: task.status } };
  }
);

registerTool(
  'create_draft',
  'Create a draft for human review (e.g., GitHub issue, PR, or generic content).',
  {
    type: 'object',
    properties: {
      draftType: { type: 'string', description: 'Type: github_issue, github_pr, generic' },
      content: { type: 'object', description: 'Draft content (varies by type)' },
    },
    required: ['draftType', 'content'],
  },
  async (args, ctx) => {
    const [draft] = await db.insert(drafts).values({
      cellId: ctx.cellId,
      userId: ctx.userId,
      draftType: args.draftType as string,
      content: args.content as Record<string, unknown>,
    }).returning();
    return { draft: { id: draft.id, draftType: draft.draftType, status: draft.status } };
  }
);

registerTool(
  'save_memory',
  'Save a fact about the user for future reference. Use when user says "remember that..." or shares a preference.',
  {
    type: 'object',
    properties: {
      category: { type: 'string', enum: ['profile', 'time_pref', 'comm_style', 'work_rule'] },
      content: { type: 'string', description: 'The fact to remember (natural language)' },
    },
    required: ['category', 'content'],
  },
  async (args, ctx) => {
    const [mem] = await db.insert(userMemories).values({
      userId: ctx.userId,
      category: args.category as string,
      content: args.content as string,
    }).returning();
    return { saved: true, id: mem.id };
  }
);

registerTool(
  'get_user_memories',
  'Retrieve saved user memories/preferences.',
  { type: 'object', properties: {} },
  async (_args, ctx) => {
    const mems = await db.select().from(userMemories).where(eq(userMemories.userId, ctx.userId));
    return { memories: mems.map(m => ({ category: m.category, content: m.content })) };
  }
);

// ─── Exports ─────────────────────────────────────────────

export function getToolDefs(): LLMToolDef[] {
  return Array.from(toolRegistry.values()).map(t => t.def);
}

export async function executeTool(call: LLMToolCall, ctx: ToolContext): Promise<unknown> {
  const tool = toolRegistry.get(call.name);
  if (!tool) {
    return { error: `Unknown tool: ${call.name}` };
  }
  try {
    return await tool.handler(call.arguments, ctx);
  } catch (e) {
    console.error(`[Tools] Error executing ${call.name}:`, (e as Error).message);
    return { error: (e as Error).message };
  }
}

export function registerExternalTools(toolDefs: { name: string; description: string; parameters: Record<string, unknown>; handler: ToolHandler }[]) {
  for (const t of toolDefs) {
    registerTool(t.name, t.description, t.parameters, t.handler);
  }
}
