import { db } from '../db/index.js';
import { messages, conversations, cells, tasks, connections, cellState, users } from '../db/schema.js';
import { eq, desc, and } from 'drizzle-orm';
import { chat, type LLMMessage } from '../lib/llm.js';
import { buildSystemPrompt, type PromptContext } from './prompt.js';
import { getToolDefs, executeTool, type ToolContext } from './tools.js';
import { embedMessage } from '../lib/embeddings.js';
import { compressCellState } from './memory.js';
import { broadcast } from '../lib/websocket.js';
import { logAgentAction } from '../services/agent-log.js';
import { CitationTracker } from './citations.js';

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
  citations: { index: number; type: string; name: string; url?: string }[];
}

const MAX_TOOL_ROUNDS = 5;
const MAX_HISTORY = 20;

export async function runConductor(signal: Signal): Promise<ConductorResult> {
  const batchId = crypto.randomUUID();
  console.log(`[Conductor] Processing ${signal.type} signal from user ${signal.userId} (batch: ${batchId.substring(0, 8)})`);
  const toolsUsed: string[] = [];
  const citations = new CitationTracker();

  await logAgentAction(signal.userId, signal.cellId || null, 'chat_response', {
    signalType: signal.type,
    contentPreview: signal.content?.substring(0, 100),
  }, batchId);

  // ─── Step 1: Resolve Cell & Conversation ─────────
  let cellId = signal.cellId;
  let conversationId = signal.conversationId;

  if (!cellId) {
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

  await db.update(cells).set({ lastSeenAt: new Date() }).where(eq(cells.id, cellId));

  if (!conversationId) {
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
      metadata: signal.metadata || null,
    }).returning();

    broadcast(signal.userId, { type: 'message', payload: userMsg });
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
      finalResponse = result.content;
      break;
    }

    llmMessages.push({ role: 'assistant', content: result.content || '' });

    for (const toolCall of result.toolCalls) {
      console.log(`[Conductor] Tool call: ${toolCall.name}(${JSON.stringify(toolCall.arguments).substring(0, 100)})`);
      toolsUsed.push(toolCall.name);

      const toolResult = await executeTool(toolCall, toolCtx);

      // Track citation for each tool result
      citations.add('tool_result', toolCall.name, undefined, JSON.stringify(toolResult).substring(0, 200));

      await logAgentAction(signal.userId, cellId, 'tool_execution', {
        tool: toolCall.name,
        argsPreview: JSON.stringify(toolCall.arguments).substring(0, 200),
      }, batchId);

      llmMessages.push({
        role: 'user',
        content: `[Tool result for ${toolCall.name}]: ${JSON.stringify(toolResult)}`,
      });
    }

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
      metadata: {
        toolsUsed,
        citations: citations.toJSON(),
      },
    }).returning();

    broadcast(signal.userId, {
      type: 'message',
      payload: { ...aiMsg, citations: citations.toJSON() },
    });
    embedMessage(aiMsg.id, finalResponse).catch(() => {});
  }

  // ─── Step 6: Background Compression ──────────────
  const msgCount = history.length;
  if (msgCount > 0 && msgCount % 10 === 0) {
    compressCellState(cellId, conversationId).catch(e => {
      console.warn('[Conductor] Background compression failed:', (e as Error).message);
    });
    await logAgentAction(signal.userId, cellId, 'memory_compressed', {
      messageCount: msgCount,
    }, batchId);
  }

  return {
    response: finalResponse,
    cellId,
    conversationId,
    toolsUsed,
    citations: citations.toJSON(),
  };
}
