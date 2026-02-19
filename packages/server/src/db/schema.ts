import {
  pgTable, uuid, varchar, text, timestamp, boolean, integer, bigint, jsonb, index, customType,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ─── Custom pgvector type ──────────────────────────────
const vector = customType<{ data: number[]; dpiType: string }>({
  dataType() { return 'vector(768)'; },
  fromDriver(value: unknown) { 
    if (typeof value === 'string') {
      return value.replace(/[\[\]]/g, '').split(',').map(Number);
    }
    return value as number[];
  },
  toDriver(value: number[]) { return `[${value.join(',')}]`; },
});

// ─── Users ───────────────────────────────────────────────
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  name: varchar('name', { length: 255 }),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  timezone: varchar('timezone', { length: 50 }).default('UTC').notNull(),
  language: varchar('language', { length: 10 }).default('en').notNull(),
  notificationPolicy: varchar('notification_policy', { length: 20 }).default('auto').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ─── Cells (Semantic Context Clusters) ───────────────────
export const cells = pgTable('cells', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  name: varchar('name', { length: 500 }).notNull(),
  fingerprint: text('fingerprint'),
  status: varchar('status', { length: 20 }).default('active').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_cells_user_id').on(table.userId),
  index('idx_cells_status').on(table.status),
]);

// ─── Cell State (Compressed Cognition L2/L3/L5/L6 + heartbeat) ──
export const cellState = pgTable('cell_state', {
  id: uuid('id').primaryKey().defaultRandom(),
  cellId: uuid('cell_id').references(() => cells.id, { onDelete: 'cascade' }).notNull(),
  layer: varchar('layer', { length: 20 }).notNull(), // L2, L3, L5, L6, heartbeat, heartbeat_state, state
  content: text('content').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_cell_state_cell_layer').on(table.cellId, table.layer),
]);

// ─── Workspace Files (persistent task state) ─────────────
export const workspaceFiles = pgTable('workspace_files', {
  id: uuid('id').primaryKey().defaultRandom(),
  cellId: uuid('cell_id').references(() => cells.id, { onDelete: 'cascade' }).notNull(),
  path: varchar('path', { length: 500 }).notNull(),
  content: text('content').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_workspace_files_cell_path').on(table.cellId, table.path),
]);

// ─── Conversations ───────────────────────────────────────
export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  cellId: uuid('cell_id').references(() => cells.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_conversations_cell_id').on(table.cellId),
]);

// ─── Messages ────────────────────────────────────────────
export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').references(() => conversations.id, { onDelete: 'cascade' }).notNull(),
  role: varchar('role', { length: 20 }).notNull(),
  content: text('content').notNull(),
  metadata: jsonb('metadata'),
  reactions: jsonb('reactions'), // Array of { emoji, userId, timestamp }
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_messages_conversation_id').on(table.conversationId),
  index('idx_messages_created_at').on(table.createdAt),
]);

// ─── Tasks ───────────────────────────────────────────────
export const tasks = pgTable('tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  cellId: uuid('cell_id').references(() => cells.id, { onDelete: 'cascade' }).notNull(),
  conversationId: uuid('conversation_id').references(() => conversations.id),
  title: varchar('title', { length: 500 }).notNull(),
  executor: varchar('executor', { length: 10 }).notNull(),
  status: varchar('status', { length: 30 }).default('pending').notNull(),
  action: text('action'),
  actionContext: jsonb('action_context'),
  triggerType: varchar('trigger_type', { length: 20 }),
  triggerConfig: jsonb('trigger_config'),
  condition: text('condition'), // AI-evaluated condition for event triggers
  whyHuman: text('why_human'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
}, (table) => [
  index('idx_tasks_cell_id').on(table.cellId),
  index('idx_tasks_status').on(table.status),
  index('idx_tasks_trigger_type').on(table.triggerType),
]);

// ─── Task Runs ───────────────────────────────────────────
export const taskRuns = pgTable('task_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'cascade' }).notNull(),
  status: varchar('status', { length: 20 }).notNull(),
  result: jsonb('result'),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
}, (table) => [
  index('idx_task_runs_task_id').on(table.taskId),
]);

// ─── User Memories ───────────────────────────────────────
export const userMemories = pgTable('user_memories', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  category: varchar('category', { length: 20 }).notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_user_memories_user_id').on(table.userId),
]);

// ─── Drafts ──────────────────────────────────────────────
export const drafts = pgTable('drafts', {
  id: uuid('id').primaryKey().defaultRandom(),
  cellId: uuid('cell_id').references(() => cells.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  draftType: varchar('draft_type', { length: 30 }).notNull(),
  content: jsonb('content').notNull(),
  status: varchar('status', { length: 20 }).default('pending').notNull(),
  version: integer('version').default(1).notNull(), // For draft modification tracking
  parentDraftId: uuid('parent_draft_id'), // Links to previous version
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ─── Uploaded Files ──────────────────────────────────────
export const uploadedFiles = pgTable('uploaded_files', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  cellId: uuid('cell_id').references(() => cells.id),
  conversationId: uuid('conversation_id').references(() => conversations.id), // Link to conversation
  messageId: uuid('message_id').references(() => messages.id), // Link to specific message
  filename: varchar('filename', { length: 500 }).notNull(),
  mimeType: varchar('mime_type', { length: 100 }).notNull(),
  sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
  storageKey: varchar('storage_key', { length: 500 }).notNull(),
  analysisResult: jsonb('analysis_result'), // Cached file analysis
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ─── Connections (GitHub OAuth) ──────────────────────────
export const connections = pgTable('connections', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  provider: varchar('provider', { length: 50 }).notNull(),
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token'),
  tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true }),
  metadata: jsonb('metadata'),
  status: varchar('status', { length: 20 }).default('active').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_connections_user_provider').on(table.userId, table.provider),
]);

// ─── Message Embeddings (pgvector) ───────────────────────
export const messageEmbeddings = pgTable('message_embeddings', {
  id: uuid('id').primaryKey().defaultRandom(),
  messageId: uuid('message_id').references(() => messages.id, { onDelete: 'cascade' }).notNull(),
  embedding: vector('embedding'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_message_embeddings_message_id').on(table.messageId),
]);

// ─── Agent Runs (Activity Log) ──────────────────────────
export const agentRuns = pgTable('agent_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  cellId: uuid('cell_id').references(() => cells.id),
  action: varchar('action', { length: 50 }).notNull(),
  details: jsonb('details'),
  batchId: uuid('batch_id'), // Groups related actions
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_agent_runs_user_action').on(table.userId, table.action),
  index('idx_agent_runs_batch').on(table.batchId),
  index('idx_agent_runs_created').on(table.createdAt),
]);
