import { db } from '../db/index.js';
import { messageEmbeddings } from '../db/schema.js';
import { eq, sql, desc } from 'drizzle-orm';
import { embed } from './llm.js';

// ─── Vector Embeddings Service ─────────────────────────
// Uses pgvector for semantic search over conversation history

export async function embedMessage(messageId: string, content: string): Promise<void> {
  try {
    const vector = await embed(content);
    await db.insert(messageEmbeddings).values({
      messageId,
      embedding: vector,
    });
  } catch (e) {
    console.warn('[Embeddings] Failed to embed message (non-critical):', (e as Error).message);
  }
}

export async function searchSimilar(
  query: string,
  limit: number = 5,
  conversationId?: string
): Promise<{ messageId: string; similarity: number }[]> {
  const queryVector = await embed(query);
  const vectorStr = `[${queryVector.join(',')}]`;

  // Raw SQL for pgvector cosine similarity search
  const result = await db.execute(sql`
    SELECT me.message_id, 
           1 - (me.embedding <=> ${vectorStr}::vector) AS similarity
    FROM message_embeddings me
    ${conversationId 
      ? sql`JOIN messages m ON m.id = me.message_id WHERE m.conversation_id = ${conversationId}`
      : sql``}
    ORDER BY me.embedding <=> ${vectorStr}::vector
    LIMIT ${limit}
  `);

  return (result.rows || result) as { messageId: string; similarity: number }[];
}
