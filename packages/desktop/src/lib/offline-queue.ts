import { useStore } from './store';

// ═══════════════════════════════════════════════════════
// OFFLINE MESSAGE QUEUE
// Queues messages when WebSocket is disconnected,
// replays them when connection restores
// ═══════════════════════════════════════════════════════

interface QueuedMessage {
  id: string;
  conversationId: string;
  content: string;
  timestamp: number;
}

const STORAGE_KEY = 'surething-offline-queue';

function loadQueue(): QueuedMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveQueue(queue: QueuedMessage[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
}

export function enqueueMessage(conversationId: string, content: string): string {
  const queue = loadQueue();
  const id = `offline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  queue.push({ id, conversationId, content, timestamp: Date.now() });
  saveQueue(queue);
  console.log(`[OfflineQueue] Enqueued message ${id} (${queue.length} pending)`);
  return id;
}

export function getQueuedMessages(): QueuedMessage[] {
  return loadQueue();
}

export function removeFromQueue(id: string): void {
  const queue = loadQueue().filter(m => m.id !== id);
  saveQueue(queue);
}

export function clearQueue(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function getQueueSize(): number {
  return loadQueue().length;
}

// Replay all queued messages through the provided send function
export async function replayQueue(
  sendFn: (conversationId: string, content: string) => Promise<void>
): Promise<{ sent: number; failed: number }> {
  const queue = loadQueue();
  if (queue.length === 0) return { sent: 0, failed: 0 };

  console.log(`[OfflineQueue] Replaying ${queue.length} queued messages`);
  let sent = 0;
  let failed = 0;

  for (const msg of queue) {
    try {
      await sendFn(msg.conversationId, msg.content);
      removeFromQueue(msg.id);
      sent++;
    } catch (e) {
      console.warn(`[OfflineQueue] Failed to replay ${msg.id}:`, e);
      failed++;
      break; // Stop on first failure to preserve order
    }
  }

  return { sent, failed };
}
