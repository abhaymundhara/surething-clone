import { useStore } from './store';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

async function request(path: string, options: RequestInit = {}) {
  const token = useStore.getState().token;
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Request failed');
  return data.data;
}

export const api = {
  // Chat
  getConversations: () => request('/api/chat/conversations'),
  getMessages: (convId: string) => request(`/api/chat/conversations/${convId}/messages`),
  sendMessage: (convId: string, content: string) =>
    request(`/api/chat/conversations/${convId}/messages`, { method: 'POST', body: JSON.stringify({ content }) }),
  createConversation: (cellName?: string) =>
    request('/api/chat/conversations', { method: 'POST', body: JSON.stringify({ cellName }) }),

  // Tasks
  getTasks: (cellId?: string) => request(`/api/tasks${cellId ? `?cellId=${cellId}` : ''}`),
  approveTask: (taskId: string) => request(`/api/tasks/${taskId}/approve`, { method: 'POST' }),
  rejectTask: (taskId: string) => request(`/api/tasks/${taskId}/reject`, { method: 'POST' }),

  // Cells
  getCells: () => request('/api/cells'),
  getCell: (id: string) => request(`/api/cells/${id}`),

  // Files
  uploadFile: async (file: File, cellId?: string) => {
    const token = useStore.getState().token;
    const formData = new FormData();
    formData.append('file', file);
    if (cellId) formData.append('cellId', cellId);
    const res = await fetch(`${BASE_URL}/api/files/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    return res.json();
  },
  getFiles: (cellId?: string) => request(`/api/files${cellId ? `?cellId=${cellId}` : ''}`),

  // Memories
  getMemories: () => request('/api/memories'),

  // Connections
  getConnections: () => request('/api/connections'),
  connectGitHub: () => request('/api/connections/github/auth'),

  // Health
  health: () => request('/api/health'),
};
