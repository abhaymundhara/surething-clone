import { useStore } from './store';
import { updateTrayBadge, showNativeNotification } from './native';
import { replayQueue, enqueueMessage } from './offline-queue';

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

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
  return useStore.getState().isConnected;
}

export function connectWebSocket() {
  const token = useStore.getState().token;
  if (!token) return;

  // Don't create duplicate connections
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }

  const wsUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace('http', 'ws');
  ws = new WebSocket(`${wsUrl}/api/ws`);

  ws.onopen = () => {
    console.log('[WS] Connected');
    useStore.getState().setConnected(true);
    ws?.send(JSON.stringify({ type: 'auth', token }));

    // Replay any queued offline messages
    const { api } = require('./api');
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
      if (data.type === 'task_update' && data.payload?.status === 'awaiting_user_action') {
        showNativeNotification(
          'Action Required',
          data.payload.title || 'A task needs your review'
        );
      }

      if (['task_update', 'task_approved', 'task_rejected', 'tasks_created'].includes(data.type)) {
        // Refresh tasks from the API - use dynamic import to avoid circular dep
        import('./api').then(({ api }) => {
          api.getTasks().then((tasks: any[]) => {
            useStore.getState().setTasks(tasks);
            const pending = tasks.filter(t => t.status === 'awaiting_user_action').length;
            updateTrayBadge(pending);
          }).catch(() => {});
        });
      }

      handlers.forEach(h => h(data));
    } catch (e) {
      console.warn('[WS] Parse error:', e);
    }
  };

  ws.onclose = () => {
    console.log('[WS] Disconnected');
    useStore.getState().setConnected(false);
    // Clear any existing timer before setting a new one
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(connectWebSocket, 3000);
  };

  ws.onerror = () => ws?.close();
}

export function sendWSMessage(type: string, payload: any) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, ...payload }));
  } else if (type === 'message' && payload.content && payload.conversationId) {
    enqueueMessage(payload.conversationId, payload.content);
    console.log('[WS] Message queued for offline replay');
  }
}

export function disconnectWebSocket() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  ws?.close();
  ws = null;
  useStore.getState().setConnected(false);
}
