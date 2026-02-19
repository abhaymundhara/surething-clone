import { useStore } from './store';

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

export function connectWebSocket() {
  const token = useStore.getState().token;
  if (!token) return;

  const wsUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace('http', 'ws');
  ws = new WebSocket(`${wsUrl}/api/ws`);

  ws.onopen = () => {
    console.log('[WS] Connected');
    ws?.send(JSON.stringify({ type: 'auth', token }));
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);

      if (data.type === 'message') {
        useStore.getState().addMessage(data.payload);
      }

      if (data.type === 'task_update' || data.type === 'task_approved' || data.type === 'task_rejected') {
        // Refresh tasks
        import('./api').then(({ api }) => api.getTasks().then(tasks => useStore.getState().setTasks(tasks)));
      }

      handlers.forEach(h => h(data));
    } catch (e) {
      console.warn('[WS] Parse error:', e);
    }
  };

  ws.onclose = () => {
    console.log('[WS] Disconnected, reconnecting in 3s...');
    reconnectTimer = setTimeout(connectWebSocket, 3000);
  };

  ws.onerror = () => ws?.close();
}

export function sendWSMessage(type: string, payload: any) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, ...payload }));
  }
}

export function disconnectWebSocket() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  ws?.close();
  ws = null;
}
