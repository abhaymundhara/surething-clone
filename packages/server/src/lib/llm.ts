import { Ollama } from 'ollama';

// Unified LLM interface — works with Ollama or OpenAI-compatible APIs
export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMOptions {
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

export interface LLMToolDef {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface LLMToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface LLMResult {
  content: string;
  toolCalls: LLMToolCall[];
}

const provider = process.env.LLM_PROVIDER || 'ollama';

// ─── Ollama client ───────────────────────────────────────
const ollama = new Ollama({
  host: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
});
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';
const EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text';

async function chatOllama(
  messages: LLMMessage[],
  options: LLMOptions = {},
  tools?: LLMToolDef[]
): Promise<LLMResult> {
  const model = options.model || OLLAMA_MODEL;

  const response = await ollama.chat({
    model,
    messages,
    options: {
      temperature: options.temperature ?? 0.7,
      num_predict: options.maxTokens ?? 4096,
    },
    keep_alive: '10m',
    ...(tools && tools.length > 0 ? { tools } : {}),
  });

  const toolCalls: LLMToolCall[] = [];
  if (response.message.tool_calls) {
    for (const tc of response.message.tool_calls) {
      toolCalls.push({
        name: tc.function.name,
        arguments: tc.function.arguments as Record<string, unknown>,
      });
    }
  }

  return {
    content: response.message.content || '',
    toolCalls,
  };
}

// ─── OpenAI-compatible client ────────────────────────────
async function chatOpenAI(
  messages: LLMMessage[],
  options: LLMOptions = {},
  tools?: LLMToolDef[]
): Promise<LLMResult> {
  const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const apiKey = process.env.OPENAI_API_KEY || '';
  const model = options.model || process.env.OPENAI_MODEL || 'gpt-4o';

  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 4096,
  };
  if (tools && tools.length > 0) {
    body.tools = tools;
  }

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`OpenAI API error: ${res.status} ${await res.text()}`);
  }

  const data = await res.json() as any;
  const choice = data.choices?.[0];
  const toolCalls: LLMToolCall[] = [];

  if (choice?.message?.tool_calls) {
    for (const tc of choice.message.tool_calls) {
      toolCalls.push({
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments),
      });
    }
  }

  return {
    content: choice?.message?.content || '',
    toolCalls,
  };
}

// ─── Public API ──────────────────────────────────────────
export async function chat(
  messages: LLMMessage[],
  options: LLMOptions = {},
  tools?: LLMToolDef[]
): Promise<LLMResult> {
  if (provider === 'openai') {
    return chatOpenAI(messages, options, tools);
  }
  return chatOllama(messages, options, tools);
}

export async function embed(text: string): Promise<number[]> {
  if (provider === 'openai') {
    const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
    const apiKey = process.env.OPENAI_API_KEY || '';
    const res = await fetch(`${baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_EMBED_MODEL || 'text-embedding-3-small',
        input: text,
      }),
    });
    const data = await res.json() as any;
    return data.data?.[0]?.embedding || [];
  }

  const result = await ollama.embed({ model: EMBED_MODEL, input: text });
  return result.embeddings[0] || [];
}

export async function healthCheck(): Promise<{
  provider: string;
  ok: boolean;
  error?: string;
}> {
  try {
    if (provider === 'openai') {
      return { provider: 'openai', ok: true }; // No simple health check
    }
    const list = await ollama.list();
    const hasModel = list.models.some((m) => m.name.startsWith(OLLAMA_MODEL));
    return {
      provider: 'ollama',
      ok: hasModel,
      error: hasModel ? undefined : `Model ${OLLAMA_MODEL} not found. Run: ollama pull ${OLLAMA_MODEL}`,
    };
  } catch (e) {
    return { provider, ok: false, error: (e as Error).message };
  }
}
