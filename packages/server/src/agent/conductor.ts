import { db } from '../db/index.js';
import { messages, conversations, cells, tasks, connections, cellState } from '../db/schema.js';
import { eq, desc, and } from 'drizzle-orm';
import { chat, type LLMMessage } from '../lib/llm.js';
import { buildSystemPrompt, type PromptContext } from './prompt.js';
import { getToolDefs, executeTool, type ToolContext } from './tools.js';
import { embedMessage } from '../lib/embeddings.js';
import { compressCellState } from './memory.js';
import { broadcast } from '../lib/websocket.js';
import { users } from '../db/schema.js';

// ═══════════════════════════════════════════════════════
// CONDUCTOR — Central Agent Orchestrator
// Signal → Context Assembly → LLM Reasoning → Tool Execution → Response
// ═══════════════════════════════════════════════════════

export interface Signal {
  type: 'chat_message' | 'timer' | 'event' | 'heartbeat';
  userId: string;
  cellId?: string;
  conversationId?: string;
  content?: string;
  metadata?: Record<string, unknown>;
}

export interface ConductorResult {
  response: string;
  cellId: string;
  conversationId: string;
  toolsUsed: string[];
}

const MAX_TOOL_ROUNDS = 5; // Max iterations of tool calling
const MAX_HISTORY = 20;    // Max messages in context

export async function runConductor(signal: Signal): Promise<ConductorResult> {
  console.log(`[Conductor] Processing ${signal.type} signal from user ${signal.userId}`);
  const toolsUsed: string[] = [];

  // ─── Step 1: Resolve Cell & Conversation ─────────
  let cellId = signal.cellId;
  let conversationId = signal.conversationId;

  if (!cellId) {
    // Create or find a default cell for this user
    const existing = await db.select().from(cells)
      .where(and(eq(cells.userId, signal.userId), eq(cells.status, 'active')))
      .orderBy(desc(cells.lastSeenAt))
      .limit(1);

    if (existing.length > 0) {
      cellId = existing[0].id;
    } else {
      const [newCell] = await db.insert(cells).values({
        userId: signal.userId,
        name: 'General',
        status: 'active',
      }).returning();
      cellId = newCell.id;
    }
  }

  // Update cell last seen
  await db.update(cells).set({ lastSeenAt: new Date() }).where(eq(cells.id, cellId));

  if (!conversationId) {
    // Create or find conversation for this cell
    const existing = await db.select().from(conversations)
      .where(and(eq(conversations.cellId, cellId), eq(conversations.userId, signal.userId)))
      .orderBy(desc(conversations.createdAt))
      .limit(1);

    if (existing.length > 0) {
      conversationId = existing[0].id;
    } else {
      const [conv] = await db.insert(conversations).values({
        cellId,
        userId: signal.userId,
      }).returning();
      conversationId = conv.id;
    }
  }

  // ─── Step 2: Save incoming message ───────────────
  if (signal.type === 'chat_message' && signal.content) {
    const [userMsg] = await db.insert(messages).values({
      conversationId,
      role: 'user',
      content: signal.content,
    }).returning();

    broadcast(signal.userId, { type: 'message', payload: userMsg });

    // Embed asynchronously (don't block)
    embedMessage(userMsg.id, signal.content).catch(() => {});
  }

  // ─── Step 3: Assemble Context ────────────────────
  const [user] = await db.select().from(users).where(eq(users.id, signal.userId));
  const [cell] = await db.select().from(cells).where(eq(cells.id, cellId));
  const activeTasks = await db.select().from(tasks)
    .where(and(eq(tasks.cellId, cellId), eq(tasks.status, 'pending')))
    .limit(10);

  const history = await db.select().from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.createdAt))
    .limit(MAX_HISTORY);

  const conns = await db.select().from(connections)
    .where(and(eq(connections.userId, signal.userId), eq(connections.status, 'active')));

  const promptCtx: PromptContext = {
    user: {
      id: user.id,
      name: user.name,
      timezone: user.timezone,
      language: user.language,
      email: user.email,
    },
    cell: { id: cell.id, name: cell.name, status: cell.status },
    activeTasks: activeTasks.map(t => ({
      id: t.id, title: t.title, status: t.status, executor: t.executor,
    })),
    conversationHistory: history.reverse().map(m => ({
      role: m.role, content: m.content,
    })),
    connectedApps: conns.map(c => c.provider),
  };

  const systemPrompt = await buildSystemPrompt(promptCtx);

  // ─── Step 4: LLM Reasoning Loop ─────────────────
  const llmMessages: LLMMessage[] = [
    { role: 'system', content: systemPrompt },
    ...history.reverse().map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  ];

  // If this is a timer/heartbeat signal, add a system message
  if (signal.type === 'timer' || signal.type === 'heartbeat') {
    llmMessages.push({
      role: 'user',
      content: `[System: ${signal.type} triggered] ${signal.content || 'Check in and take proactive action if needed.'}`,
    });
  }

  const toolDefs = getToolDefs();
  const toolCtx: ToolContext = { userId: signal.userId, cellId, conversationId };
  let finalResponse = '';

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const result = await chat(llmMessages, { temperature: 0.7 }, toolDefs);

    if (result.toolCalls.length === 0) {
      // No more tool calls — this is the final response
      finalResponse = result.content;
      break;
    }

    // Execute tool calls
    llmMessages.push({ role: 'assistant', content: result.content || '' });

    for (const toolCall of result.toolCalls) {
      console.log(`[Conductor] Tool call: ${toolCall.name}(${JSON.stringify(toolCall.arguments).substring(0, 100)})`);
      toolsUsed.push(toolCall.name);

      const toolResult = await executeTool(toolCall, toolCtx);

      // Add tool result as user message (Ollama format)
      llmMessages.push({
        role: 'user',
        content: `[Tool result for ${toolCall.name}]: ${JSON.stringify(toolResult)}`,
      });
    }

    // If this is the last round, get final response
    if (round === MAX_TOOL_ROUNDS - 1) {
      const final = await chat(llmMessages, { temperature: 0.7 });
      finalResponse = final.content;
    }
  }

  // ─── Step 5: Save Response ───────────────────────
  if (finalResponse) {
    const [aiMsg] = await db.insert(messages).values({
      conversationId,
      role: 'assistant',
      content: finalResponse,
    }).returning();

    broadcast(signal.userId, { type: 'message', payload: aiMsg });
    embedMessage(aiMsg.id, finalResponse).catch(() => {});
  }

  // ─── Step 6: Background Compression ──────────────
  // Compress state after every 10 messages (async, don't block)
  const msgCount = history.length;
  if (msgCount > 0 && msgCount % 10 === 0) {
    compressCellState(cellId, conversationId).catch(e => {
      console.warn('[Conductor] Background compression failed:', (e as Error).message);
    });
  }

  return {
    response: finalResponse,
    cellId,
    conversationId,
    toolsUsed,
  };
}
