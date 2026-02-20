import { create } from 'zustand';

interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  metadata?: Record<string, any>;
}

interface Conversation {
  id: string;
  cellId: string;
  createdAt: string;
}

interface Task {
  id: string;
  title: string;
  status: string;
  executor: string;
  cellId: string;
  createdAt: string;
  actionContext?: Record<string, any>;
}

interface AppState {
  // Auth
  token: string | null;
  user: { id: string; name: string; email: string } | null;
  setAuth: (token: string, user: AppState['user']) => void;
  logout: () => void;

  // Navigation
  currentView: 'chat' | 'tasks' | 'files' | 'settings';
  setView: (view: AppState['currentView']) => void;

  // Conversations
  conversations: Conversation[];
  currentConversationId: string | null;
  currentCellId: string | null;
  setConversations: (convs: Conversation[]) => void;
  setCurrentConversation: (convId: string | null, cellId?: string | null) => void;

  // Messages
  messages: Message[];
  setMessages: (msgs: Message[]) => void;
  addMessage: (msg: Message) => void;

  // Tasks
  tasks: Task[];
  setTasks: (tasks: Task[]) => void;
  updateTask: (taskId: string, updates: Partial<Task>) => void;

  // Connection
  isConnected: boolean;
  setConnected: (connected: boolean) => void;

  // Toast
  toasts: { id: string; message: string; type: 'success' | 'error' | 'info' }[];
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  removeToast: (id: string) => void;
}

export const useStore = create<AppState>((set) => ({
  // Auth
  token: localStorage.getItem('token'),
  user: null,
  setAuth: (token, user) => {
    localStorage.setItem('token', token);
    set({ token, user });
  },
  logout: () => {
    localStorage.removeItem('token');
    set({ token: null, user: null, conversations: [], messages: [], tasks: [] });
  },

  // Navigation
  currentView: 'chat',
  setView: (view) => set({ currentView: view }),

  // Conversations
  conversations: [],
  currentConversationId: null,
  currentCellId: null,
  setConversations: (conversations) => set({ conversations }),
  setCurrentConversation: (convId, cellId) => set({
    currentConversationId: convId,
    currentCellId: cellId ?? null,
  }),

  // Messages
  messages: [],
  setMessages: (messages) => set({ messages }),
  addMessage: (msg) => set((state) => {
    // Deduplicate by id, also remove temp messages if server version arrives
    const filtered = state.messages.filter(m =>
      m.id !== msg.id && !m.id.startsWith('temp-')
    );
    return { messages: [...filtered, msg] };
  }),

  // Tasks
  tasks: [],
  setTasks: (tasks) => set({ tasks }),
  updateTask: (taskId, updates) => set((state) => ({
    tasks: state.tasks.map(t => t.id === taskId ? { ...t, ...updates } : t),
  })),

  // Connection
  isConnected: false,
  setConnected: (isConnected) => set({ isConnected }),

  // Toasts
  toasts: [],
  addToast: (message, type = 'info') => {
    const id = `toast-${Date.now()}`;
    set((state) => ({
      toasts: [...state.toasts, { id, message, type }],
    }));
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter(t => t.id !== id),
      }));
    }, 4000);
  },
  removeToast: (id) => set((state) => ({
    toasts: state.toasts.filter(t => t.id !== id),
  })),
}));
