import { Ollama } from 'ollama';
import { db } from '../db/index.js';
import { files } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { getPresignedDownloadUrl } from '../lib/file-store.js';

// ═══════════════════════════════════════════════════════
// FILE ANALYSIS — AI-powered file content analysis
// Supports text extraction + LLM summarization
// ═══════════════════════════════════════════════════════

const ollama = new Ollama({ host: process.env.OLLAMA_URL || 'http://localhost:11434' });
const VISION_MODEL = process.env.OLLAMA_VISION_MODEL || 'llava';
const TEXT_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';

const TEXT_MIME_TYPES = [
  'text/plain', 'text/markdown', 'text/csv', 'text/html',
  'application/json', 'application/xml', 'text/xml',
];

const IMAGE_MIME_TYPES = [
  'image/png', 'image/jpeg', 'image/webp', 'image/gif',
];

export async function analyzeFile(
  fileId: string,
  prompt: string = 'Summarize this file content'
): Promise<{ analysis: string; model: string }> {
  const [file] = await db.select().from(files).where(eq(files.id, fileId)).limit(1);
  if (!file) throw new Error(`File ${fileId} not found`);

  const mimeType = file.mimeType || 'application/octet-stream';

  try {
    if (TEXT_MIME_TYPES.some(t => mimeType.startsWith(t))) {
      return await analyzeTextFile(file, prompt);
    } else if (IMAGE_MIME_TYPES.some(t => mimeType.startsWith(t))) {
      return await analyzeImageFile(file, prompt);
    } else {
      return {
        analysis: `File type "${mimeType}" is not directly analyzable. ` +
          `Supported types: text files (plain, markdown, CSV, JSON, HTML) and images (PNG, JPEG, WebP).`,
        model: 'none',
      };
    }
  } catch (e) {
    console.error(`[FileAnalysis] Failed to analyze file ${fileId}:`, (e as Error).message);
    throw new Error(`Analysis failed: ${(e as Error).message}`);
  }
}

async function analyzeTextFile(
  file: { id: string; storageKey: string; filename: string },
  prompt: string
): Promise<{ analysis: string; model: string }> {
  const url = await getPresignedDownloadUrl(file.storageKey);
  const response = await fetch(url);
  let text = await response.text();

  // Truncate for LLM context window
  const MAX_CHARS = 30000;
  if (text.length > MAX_CHARS) {
    text = text.substring(0, MAX_CHARS) + '\n\n[... truncated, showing first 30k characters]';
  }

  const result = await ollama.chat({
    model: TEXT_MODEL,
    messages: [{
      role: 'user',
      content: `File: ${file.filename}\n\nContent:\n${text}\n\n${prompt}`,
    }],
    options: { temperature: 0.3 },
    keep_alive: '10m',
  });

  return { analysis: result.message.content, model: TEXT_MODEL };
}

async function analyzeImageFile(
  file: { id: string; storageKey: string; filename: string },
  prompt: string
): Promise<{ analysis: string; model: string }> {
  const url = await getPresignedDownloadUrl(file.storageKey);
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');

  // Use Ollama's native multimodal support (images field on the message)
  const result = await ollama.chat({
    model: VISION_MODEL,
    messages: [{
      role: 'user',
      content: `${prompt}\n\nImage file: ${file.filename}`,
      images: [base64],
    }],
    options: { temperature: 0.3 },
    keep_alive: '10m',
  });

  return { analysis: result.message.content, model: VISION_MODEL };
}

export async function updateFileAnalysis(fileId: string, analysis: string): Promise<void> {
  await db.update(files)
    .set({
      analysisResult: { analysis, analyzedAt: new Date().toISOString() },
      updatedAt: new Date(),
    })
    .where(eq(files.id, fileId));
}
