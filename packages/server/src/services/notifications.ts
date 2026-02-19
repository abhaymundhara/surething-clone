import { broadcast } from '../lib/websocket.js';
import { logAgentAction } from './agent-log.js';

// ═══════════════════════════════════════════════════════
// NOTIFICATION SERVICE
// Handles immediate, deferred (digest), and auto notifications
// ═══════════════════════════════════════════════════════

export type NotificationPolicy = 'immediate' | 'defer' | 'auto';

interface Notification {
  userId: string;
  type: 'info' | 'action_required' | 'error' | 'success';
  title: string;
  body: string;
  cellId?: string;
  taskId?: string;
  metadata?: Record<string, unknown>;
}

// In-memory digest buffer (production: use Redis)
const digestBuffer = new Map<string, Notification[]>();

export function notify(notification: Notification, policy: NotificationPolicy = 'auto'): void {
  const shouldImmediate = policy === 'immediate' ||
    (policy === 'auto' && (notification.type === 'action_required' || notification.type === 'error'));

  if (shouldImmediate) {
    broadcast(notification.userId, {
      type: 'notification',
      payload: notification,
    });
  } else {
    // Buffer for digest
    const buffer = digestBuffer.get(notification.userId) || [];
    buffer.push(notification);
    digestBuffer.set(notification.userId, buffer);
  }
}

export function getAndFlushDigest(userId: string): Notification[] {
  const buffer = digestBuffer.get(userId) || [];
  digestBuffer.delete(userId);
  return buffer;
}

export function getPendingDigestCount(userId: string): number {
  return (digestBuffer.get(userId) || []).length;
}
