import type { WSContext } from 'hono/ws';

// In-memory WebSocket connection store (single-user system)
const connections = new Map<string, Set<WSContext>>();

export function addConnection(userId: string, ws: WSContext): void {
  if (!connections.has(userId)) {
    connections.set(userId, new Set());
  }
  connections.get(userId)!.add(ws);
  console.log(`[WS] Connected: ${userId} (${connections.get(userId)!.size} total)`);
}

export function removeConnection(userId: string, ws: WSContext): void {
  const conns = connections.get(userId);
  if (conns) {
    conns.delete(ws);
    if (conns.size === 0) connections.delete(userId);
  }
  console.log(`[WS] Disconnected: ${userId}`);
}

export function broadcast(userId: string, event: { type: string; payload: unknown }): void {
  const conns = connections.get(userId);
  if (!conns) return;
  const message = JSON.stringify(event);
  for (const ws of conns) {
    try {
      ws.send(message);
    } catch {
      conns.delete(ws);
    }
  }
}

export function broadcastAll(event: { type: string; payload: unknown }): void {
  for (const [userId] of connections) {
    broadcast(userId, event);
  }
}
