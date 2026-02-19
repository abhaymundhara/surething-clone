import { useStore } from './store';
import { updateTrayBadge, showNativeNotification } from './native';
import { replayQueue, enqueueMessage } from './offline-queue';
import { api } from './api';

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let isConnected = false;

type MessageHandler = (data: any) => void;
const handlers: MessageHandler[] = [];

export function onMessage(handler: MessageHandler) {
  handlers.push(handler);
  return () => {
    const idx = handlers.indexOf(handler);
    if (idx >= 0) handlers.splice(idx, 1);
  };
}

export function getConnectionStatus(): boolean {
  return isConnected;
}

export function connectWebSocket() {
  const token = useStore.getState().token;
  if (!token) return;

  const wsUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace('http', 'ws');
  ws = new WebSocket(`${wsUrl}/api/ws`);

  ws.onopen = () => {
    console.log('[WS] Connected');
    isConnected = true;
    ws?.send(JSON.stringify({ type: 'auth', token }));

    // Replay any queued offline messages
    replayQueue(async (convId, content) => {
      await api.sendMessage(convId, content);
    }).then(({ sent, failed }) => {
      if (sent > 0) console.log(`[WS] Replayed ${sent} offline messages (${failed} failed)`);
    });
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);

      if (data.type === 'message') {
        useStore.getState().addMessage(data.payload);
      }

      // Notification for HITL tasks
      if (data.type === 'notification' || data.type === 'task_update') {
        const payload = data.payload;
        if (payload?.status === 'awaiting_user_action') {
          showNativeNotification(
            'Action Required',
            payload.title || 'A task needs your review'
          );
        }
      }

      if (data.type === 'task_update' || data.type === 'task_approved' || data.type === 'task_rejected') {
        import('./api').then(({ api }) => api.getTasks().then(tasks => {
          useStore.getState().setTasks(tasks);
          // Update tray badge with pending count
          const pending = tasks.filter((t: any) => t.status === 'awaiting_user_action').length;
          updateTrayBadge(pending);
        }));
      }

      handlers.forEach(h => h(data));
    } catch (e) {
      console.warn('[WS] Parse error:', e);
    }
  };

  ws.onclose = () => {
    console.log('[WS] Disconnected, reconnecting in 3s...');
    isConnected = false;
    reconnectTimer = setTimeout(connectWebSocket, 3000);
  };

  ws.onerror = () => ws?.close();
}

// Send message with offline fallback
export function sendWSMessage(type: string, payload: any) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, ...payload }));
  } else if (type === 'message' && payload.content && payload.conversationId) {
    // Queue for offline replay
    enqueueMessage(payload.conversationId, payload.content);
    console.log('[WS] Message queued for offline replay');
  }
}

export function disconnectWebSocket() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  ws?.close();
  ws = null;
  isConnected = false;
}
