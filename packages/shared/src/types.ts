// ============================================================
// Core Domain Types for SureThing Clone
// ============================================================

// ---------- User ----------
export interface User {
  id: string;
  email: string;
  name: string | null;
  timezone: string;
  language: string;
  createdAt: Date;
}

// ---------- Cell (Semantic Context Cluster) ----------
export interface Cell {
  id: string;
  userId: string;
  name: string;
  fingerprint: string | null;
  status: 'active' | 'completed' | 'ignored';
  createdAt: Date;
  lastSeenAt: Date;
}

export interface CellState {
  id: string;
  cellId: string;
  layer: 'L2' | 'L3' | 'L5' | 'L6';
  content: string;
  updatedAt: Date;
}

// ---------- Conversation & Messages ----------
export interface Conversation {
  id: string;
  cellId: string;
  userId: string;
  createdAt: Date;
}

export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

// ---------- Tasks ----------
export interface Task {
  id: string;
  cellId: string;
  conversationId: string | null;
  title: string;
  executor: 'ai' | 'human';
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped' | 'awaiting_user_action' | 'paused';
  action: string | null;
  actionContext: TaskActionContext | null;
  triggerType: 'delay' | 'cron' | 'event' | null;
  triggerConfig: TriggerConfig | null;
  whyHuman: string | null;
  createdAt: Date;
  completedAt: Date | null;
}

export interface TaskActionContext {
  draftId?: string;
  category?: string;
  [key: string]: unknown;
}

export type TriggerConfig =
  | { expression: string; timezone?: string }          // cron
  | { delay: { value: number; unit: 'minutes' | 'hours' | 'days' } }  // delay
  | Record<string, unknown>;                            // event

export interface TaskRun {
  id: string;
  taskId: string;
  status: string;
  result: Record<string, unknown> | null;
  startedAt: Date;
  completedAt: Date | null;
}

// ---------- Memory ----------
export interface UserMemory {
  id: string;
  userId: string;
  category: 'profile' | 'time_pref' | 'comm_style' | 'work_rule';
  content: string;
  createdAt: Date;
}

// ---------- Drafts ----------
export interface Draft {
  id: string;
  cellId: string;
  userId: string;
  draftType: string;
  content: Record<string, unknown>;
  status: 'pending' | 'confirmed' | 'cancelled';
  createdAt: Date;
}

// ---------- Files ----------
export interface UploadedFile {
  id: string;
  userId: string;
  cellId: string | null;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  createdAt: Date;
}

// ---------- Connections ----------
export interface Connection {
  id: string;
  userId: string;
  provider: 'github';
  accessToken: string;
  refreshToken: string | null;
  tokenExpiresAt: Date | null;
  metadata: Record<string, unknown> | null;
  status: 'active' | 'disconnected';
  createdAt: Date;
}

// ---------- API Types ----------
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ---------- WebSocket Events ----------
export type WSEventType =
  | 'message'
  | 'task_update'
  | 'draft_update'
  | 'cell_update'
  | 'notification'
  | 'connection_status';

export interface WSEvent {
  type: WSEventType;
  payload: unknown;
  timestamp: string;
}

// ---------- Signal Types (Agent Input) ----------
export type SignalType = 'chat_message' | 'timer' | 'event' | 'heartbeat';

export interface Signal {
  type: SignalType;
  cellId: string;
  conversationId: string;
  userId: string;
  data: Record<string, unknown>;
}

// ---------- LLM Types ----------
export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface LLMResponse {
  content: string;
  toolCalls?: ToolCall[];
}
