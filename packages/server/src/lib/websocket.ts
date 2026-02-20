import type { WSContext } from 'hono/ws';

// In-memory WebSocket connection store
// Map<userId, Set<WSContext>>
const connections = new Map<string, Set<WSContext>>();

export function addConnection(userId: string, ws: WSContext) {
  if (!connections.has(userId)) {
    connections.set(userId, new Set());
  }
  connections.get(userId)!.add(ws);
}

export function removeConnection(userId: string, ws: WSContext) {
  const userConns = connections.get(userId);
  if (userConns) {
    userConns.delete(ws);
    if (userConns.size === 0) {
      connections.delete(userId);
    }
  }
}

export function broadcast(userId: string, data: unknown) {
  const userConns = connections.get(userId);
  if (!userConns) return;
  const payload = JSON.stringify(data);
  for (const ws of userConns) {
    try {
      ws.send(payload);
    } catch {
      userConns.delete(ws);
    }
  }
}

export function getConnectionCount(userId: string): number {
  return connections.get(userId)?.size ?? 0;
}
