// Cell status values
export const CELL_STATUS = {
  ACTIVE: 'active',
  COMPLETED: 'completed',
  IGNORED: 'ignored',
} as const;

// Task status values
export const TASK_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  FAILED: 'failed',
  SKIPPED: 'skipped',
  AWAITING_USER_ACTION: 'awaiting_user_action',
  PAUSED: 'paused',
} as const;

// Task executor types
export const TASK_EXECUTOR = {
  AI: 'ai',
  HUMAN: 'human',
} as const;

// Trigger types
export const TRIGGER_TYPE = {
  DELAY: 'delay',
  CRON: 'cron',
  EVENT: 'event',
} as const;

// Memory categories
export const MEMORY_CATEGORY = {
  PROFILE: 'profile',
  TIME_PREF: 'time_pref',
  COMM_STYLE: 'comm_style',
  WORK_RULE: 'work_rule',
} as const;

// Message roles
export const MESSAGE_ROLE = {
  USER: 'user',
  ASSISTANT: 'assistant',
  SYSTEM: 'system',
} as const;

// Draft types
export const DRAFT_TYPE = {
  GITHUB_ISSUE: 'github_issue',
  GITHUB_PR: 'github_pr',
  GENERIC: 'generic',
} as const;

// Connection providers
export const CONNECTION_PROVIDER = {
  GITHUB: 'github',
} as const;

// Compression layers
export const STATE_LAYER = {
  L2: 'L2',
  L3: 'L3',
  L5: 'L5',
  L6: 'L6',
} as const;

// API paths
export const API_PATHS = {
  AUTH: '/api/auth',
  CHAT: '/api/chat',
  CELLS: '/api/cells',
  TASKS: '/api/tasks',
  FILES: '/api/files',
  DRAFTS: '/api/drafts',
  MEMORIES: '/api/memories',
  CONNECTIONS: '/api/connections',
  AGENT: '/api/agent',
  WS: '/api/ws',
} as const;

// Limits
export const LIMITS = {
  MAX_FILE_SIZE_MB: 100,
  MAX_HISTORY_MESSAGES: 50,
  MAX_TASK_TITLE_LENGTH: 500,
  MIN_CRON_INTERVAL_MINUTES: 30,
  MAX_SYSTEM_PROMPT_CHARS: 12000,
} as const;
