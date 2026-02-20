const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

async function request<T = any>(
  path: string,
  options: RequestInit & { headers?: Record<string, string> } = {},
): Promise<T> {
  const token = localStorage.getItem("token");
  const headers: Record<string, string> = {
    ...(options.headers ?? {}),
  };

  // Only set Content-Type for non-FormData bodies
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Request failed: ${res.status}`);
  }

  return res.json();
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  register: (name: string, email: string, password: string) =>
    request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    }),

  getProfile: () => request("/api/auth/me"),

  // Conversations
  getConversations: () => request("/api/chat/conversations"),
  createConversation: (cellId?: string) =>
    request("/api/chat/conversations", {
      method: "POST",
      body: JSON.stringify({ cellId }),
    }),

  // Messages
  getMessages: (conversationId: string) =>
    request(`/api/chat/conversations/${conversationId}/messages`),

  sendMessage: (conversationId: string, content: string) =>
    request(`/api/chat/conversations/${conversationId}/messages`, {
      method: "POST",
      body: JSON.stringify({ content }),
    }),

  addReaction: (messageId: string, emoji: string) =>
    request(`/api/messages/${messageId}/reactions`, {
      method: "POST",
      body: JSON.stringify({ emoji }),
    }),

  // Cells
  getCells: () => request("/api/cells"),
  getCell: (id: string) => request(`/api/cells/${id}`),

  // Tasks
  getTasks: (cellId?: string) =>
    request(`/api/tasks${cellId ? `?cellId=${cellId}` : ""}`),
  approveTask: (id: string) =>
    request(`/api/tasks/${id}/approve`, { method: "POST" }),
  rejectTask: (id: string) =>
    request(`/api/tasks/${id}/reject`, { method: "POST" }),

  // Files
  getFiles: (cellId?: string) =>
    request(`/api/files${cellId ? `?cellId=${cellId}` : ""}`),

  uploadFile: async (file: File, cellId?: string) => {
    const form = new FormData();
    form.append("file", file);
    if (cellId) form.append("cellId", cellId);
    return request("/api/files/upload", {
      method: "POST",
      body: form,
    });
  },

  analyzeFile: (fileId: string, prompt?: string) =>
    request(`/api/files/${fileId}/analyze`, {
      method: "POST",
      body: JSON.stringify({ prompt }),
    }),

  // Connections
  getConnections: () => request("/api/connections"),
  initiateGitHubAuth: () => request("/api/connections/github/auth"),
  disconnectConnection: (id: string) =>
    request(`/api/connections/${id}`, { method: "DELETE" }),

  // Search
  search: (query: string) =>
    request("/api/search", {
      method: "POST",
      body: JSON.stringify({ query }),
    }),

  // Agent runs
  getAgentRuns: (limit = 50) => request(`/api/agent/runs?limit=${limit}`),
};
