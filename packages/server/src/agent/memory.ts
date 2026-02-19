import { db } from '../db/index.js';
import { cellState, messages } from '../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { chat, type LLMMessage } from '../lib/llm.js';

// ═══════════════════════════════════════════════════════
// MEMORY COMPRESSION (Tidy)
// Compresses conversation history into L2/L3/L5/L6 layers
// ═══════════════════════════════════════════════════════

const COMPRESSION_PROMPT = `You are a cognition compressor. Given a conversation history and optional existing state, produce compressed cognition layers.

OUTPUT FORMAT (markdown):

## L2: Factual History
Bullet points of key facts, decisions, dates. Append-only.

## L3: Live State
Current status of tracked items, active threads.

## L5: User Intent
Stated preferences, goals, behavioral patterns.

## L6: Action Chain
Completed actions and next steps. Tag each as:
- (AI) = agent can do proactively
- (User) = requires user action  
- (Waiting) = blocked on external input

Rules:
- Be concise. Each bullet is one key fact.
- Preserve all important information but compress aggressively.
- L6 should have clear, actionable items.
- If existing state is provided, MERGE new information — don't lose old facts.
`;

export async function compressCellState(cellId: string, conversationId: string): Promise<void> {
  console.log(`[Memory] Compressing state for cell ${cellId}`);

  // Get recent messages
  const recentMessages = await db.select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.createdAt))
    .limit(30);

  if (recentMessages.length < 3) {
    console.log('[Memory] Not enough messages to compress');
    return;
  }

  // Get existing state
  const existingStates = await db.select()
    .from(cellState)
    .where(eq(cellState.cellId, cellId));

  const existingContent = existingStates.length > 0
    ? existingStates.map(s => `## ${s.layer}\n${s.content}`).join('\n\n')
    : 'No existing state.';

  // Build conversation summary for compression
  const conversationText = recentMessages
    .reverse()
    .map(m => `[${m.role}]: ${m.content}`)
    .join('\n');

  const llmMessages: LLMMessage[] = [
    { role: 'system', content: COMPRESSION_PROMPT },
    {
      role: 'user',
      content: `EXISTING STATE:\n${existingContent}\n\nNEW CONVERSATION:\n${conversationText}\n\nProduce updated compressed cognition layers.`,
    },
  ];

  try {
    const result = await chat(llmMessages, { temperature: 0.3 });
    const output = result.content;

    // Parse layers from output
    const layers = parseCompressedLayers(output);

    // Upsert each layer
    for (const [layer, content] of Object.entries(layers)) {
      const existing = existingStates.find(s => s.layer === layer);
      if (existing) {
        await db.update(cellState)
          .set({ content, updatedAt: new Date() })
          .where(and(eq(cellState.cellId, cellId), eq(cellState.layer, layer)));
      } else {
        await db.insert(cellState).values({
          cellId,
          layer,
          content,
        });
      }
    }

    console.log(`[Memory] Compressed ${recentMessages.length} messages into ${Object.keys(layers).length} layers`);
  } catch (e) {
    console.error('[Memory] Compression failed:', (e as Error).message);
  }
}

function parseCompressedLayers(output: string): Record<string, string> {
  const layers: Record<string, string> = {};
  const layerNames = ['L2', 'L3', 'L5', 'L6'];

  for (const layer of layerNames) {
    const regex = new RegExp(`## ${layer}[:\\s].*?\\n([\\s\\S]*?)(?=## L[2356]|$)`, 'i');
    const match = output.match(regex);
    if (match) {
      layers[layer] = match[1].trim();
    }
  }

  return layers;
}
