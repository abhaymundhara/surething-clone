import { chat, type LLMMessage } from '../lib/llm.js';
import { getFileBuffer } from '../lib/file-store.js';

// ═══════════════════════════════════════════════════════
// FILE ANALYSIS PIPELINE
// Processes uploaded files (PDF, images, audio, video, text)
// using LLM vision/multimodal capabilities
// ═══════════════════════════════════════════════════════

export interface AnalysisResult {
  success: boolean;
  content: string;
  metadata?: Record<string, unknown>;
}

const SUPPORTED_TYPES: Record<string, { maxSize: number; category: string }> = {
  'application/pdf': { maxSize: 100 * 1024 * 1024, category: 'document' },
  'text/plain': { maxSize: 10 * 1024 * 1024, category: 'text' },
  'text/csv': { maxSize: 10 * 1024 * 1024, category: 'text' },
  'text/html': { maxSize: 10 * 1024 * 1024, category: 'text' },
  'application/json': { maxSize: 10 * 1024 * 1024, category: 'text' },
  'image/png': { maxSize: 32 * 1024 * 1024, category: 'image' },
  'image/jpeg': { maxSize: 32 * 1024 * 1024, category: 'image' },
  'image/webp': { maxSize: 32 * 1024 * 1024, category: 'image' },
  'audio/wav': { maxSize: 100 * 1024 * 1024, category: 'audio' },
  'audio/mpeg': { maxSize: 100 * 1024 * 1024, category: 'audio' },
  'audio/mp3': { maxSize: 100 * 1024 * 1024, category: 'audio' },
  'video/mp4': { maxSize: 100 * 1024 * 1024, category: 'video' },
  'video/webm': { maxSize: 100 * 1024 * 1024, category: 'video' },
};

export function validateFileType(mimeType: string, size: number): { valid: boolean; error?: string } {
  const typeInfo = SUPPORTED_TYPES[mimeType];
  if (!typeInfo) return { valid: false, error: `Unsupported file type: ${mimeType}` };
  if (size > typeInfo.maxSize) return { valid: false, error: `File too large: ${(size / 1024 / 1024).toFixed(1)}MB exceeds ${(typeInfo.maxSize / 1024 / 1024)}MB limit` };
  return { valid: true };
}

export async function analyzeFile(
  storageKey: string,
  mimeType: string,
  filename: string,
  prompt: string,
): Promise<AnalysisResult> {
  const typeInfo = SUPPORTED_TYPES[mimeType];
  if (!typeInfo) return { success: false, content: 'Unsupported file type' };

  try {
    const buffer = await getFileBuffer(storageKey);

    if (typeInfo.category === 'text') {
      // Text files: read directly and pass to LLM
      const text = buffer.toString('utf-8');
      const truncated = text.length > 50000 ? text.substring(0, 50000) + '\n... (truncated)' : text;
      const messages: LLMMessage[] = [
        { role: 'system', content: 'You are a file analysis assistant. Analyze the file content and answer the user\'s question.' },
        { role: 'user', content: `File: ${filename}\n\nContent:\n${truncated}\n\nQuestion: ${prompt}` },
      ];
      const result = await chat(messages, { temperature: 0.3 });
      return { success: true, content: result.content };
    }

    if (typeInfo.category === 'image') {
      // Images: use Ollama vision model (llava)
      const base64 = buffer.toString('base64');
      const messages: LLMMessage[] = [
        { role: 'user', content: `${prompt}`, images: [base64] },
      ];
      const result = await chat(messages, { temperature: 0.3, model: 'llava' });
      return { success: true, content: result.content };
    }

    // PDF, audio, video: return metadata for now (full pipeline needs external tools)
    return {
      success: true,
      content: `File "${filename}" (${mimeType}, ${(buffer.length / 1024).toFixed(1)}KB) received. Full analysis requires additional processing tools (PDF parser, whisper for audio, etc.).`,
      metadata: { size: buffer.length, type: mimeType },
    };
  } catch (e) {
    return { success: false, content: `Analysis failed: ${(e as Error).message}` };
  }
}
