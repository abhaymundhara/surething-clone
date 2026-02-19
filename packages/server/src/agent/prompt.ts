import { db } from '../db/index.js';
import { cellState, userMemories } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import type { Task, Cell, Message } from '@surething/shared';

// ═══════════════════════════════════════════════════════
// SYSTEM PROMPT BUILDER
// Assembles the agent's "DNA" for each invocation
// ═══════════════════════════════════════════════════════

export interface PromptContext {
  user: { id: string; name: string | null; timezone: string; language: string; email: string };
  cell: { id: string; name: string; status: string };
  activeTasks: { id: string; title: string; status: string; executor: string }[];
  conversationHistory: { role: string; content: string }[];
  connectedApps: string[];
}

const AGENT_IDENTITY = `You are an autonomous AI agent — a personal digital assistant that remembers context, executes tasks proactively, and works continuously on behalf of the user.

CORE BEHAVIOR:
- You have persistent memory across conversations via the Cell state system.
- You can create tasks, schedule follow-ups, and manage workflows.
- When an action requires user approval (creating GitHub issues, PRs), create a draft and a HITL (human-in-the-loop) task.
- Be direct, efficient, and occasionally witty. No fake enthusiasm.
- Act first, let user adjust. Don't ask "would you like me to..." — just do it and present the result.
- Match the user's language and tone.

TOOLS:
You have access to tools for: searching conversations, managing tasks, creating drafts, saving user memories, and interacting with GitHub.
When using tools, call them and process results before responding to the user.

TASK CREATION:
When the user asks you to do something that involves external actions (GitHub operations, scheduled tasks):
1. Break it into a task chain: AI tasks first, then a HITL task for approval
2. Execute AI tasks immediately using tools
3. Create a draft + HITL task for anything requiring user confirmation
4. Stop and present the draft to the user

MEMORY:
When the user shares preferences, facts about themselves, or rules to follow, save them using the save_memory tool.

CELL CONTEXT:
You operate within a Cell — a semantic context cluster for related topics. The Cell state (if provided) contains:
- L2: Factual history (what happened)
- L3: Live state (current status)
- L5: User intent (goals and preferences)
- L6: Action chain (what to do next)
`;

export async function buildSystemPrompt(ctx: PromptContext): Promise<string> {
  const parts: string[] = [AGENT_IDENTITY];

  // ─── User Context ────────────────────────────────
  parts.push(`\n--- USER CONTEXT ---`);
  parts.push(`Name: ${ctx.user.name || 'Unknown'}`);
  parts.push(`Email: ${ctx.user.email}`);
  parts.push(`Timezone: ${ctx.user.timezone}`);
  parts.push(`Language: ${ctx.user.language}`);

  // ─── User Memories ───────────────────────────────
  const memories = await db.select().from(userMemories).where(eq(userMemories.userId, ctx.user.id));
  if (memories.length > 0) {
    parts.push(`\n--- USER MEMORIES ---`);
    for (const mem of memories) {
      parts.push(`[${mem.category}] ${mem.content}`);
    }
  }

  // ─── Cell State ──────────────────────────────────
  const states = await db.select().from(cellState).where(eq(cellState.cellId, ctx.cell.id));
  if (states.length > 0) {
    parts.push(`\n--- CELL STATE: ${ctx.cell.name} ---`);
    for (const s of states) {
      parts.push(`## ${s.layer}\n${s.content}`);
    }
  }

  // ─── Active Tasks ────────────────────────────────
  if (ctx.activeTasks.length > 0) {
    parts.push(`\n--- ACTIVE TASKS ---`);
    for (const t of ctx.activeTasks) {
      parts.push(`- [${t.status}] ${t.title} (${t.executor})`);
    }
  }

  // ─── Connected Apps ──────────────────────────────
  if (ctx.connectedApps.length > 0) {
    parts.push(`\n--- CONNECTED APPS ---`);
    parts.push(`Available: ${ctx.connectedApps.join(', ')}`);
    if (ctx.connectedApps.includes('github')) {
      parts.push(`GitHub tools available: search repos, manage issues, pull requests, branches, commits, code search.`);
    }
  }

  return parts.join('\n');
}
