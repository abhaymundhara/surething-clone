import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  name: string | null;
}

interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
}

interface Task {
  id: string;
  title: string;
  status: string;
  executor: string;
  actionContext?: Record<string, unknown>;
}

interface Store {
  token: string | null;
  user: User | null;
  messages: Message[];
  tasks: Task[];
  currentConversationId: string | null;
  currentCellId: string | null;
  setToken: (token: string | null) => void;
  setUser: (user: User | null) => void;
  addMessage: (msg: Message) => void;
  setMessages: (msgs: Message[]) => void;
  setTasks: (tasks: Task[]) => void;
  setCurrentConversation: (id: string | null, cellId: string | null) => void;
  logout: () => void;
}

export const useStore = create<Store>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      messages: [],
      tasks: [],
      currentConversationId: null,
      currentCellId: null,
      setToken: (token) => set({ token }),
      setUser: (user) => set({ user }),
      addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),
      setMessages: (messages) => set({ messages }),
      setTasks: (tasks) => set({ tasks }),
      setCurrentConversation: (id, cellId) => set({ currentConversationId: id, currentCellId: cellId }),
      logout: () => set({ token: null, user: null, messages: [], currentConversationId: null }),
    }),
    { name: 'surething-store', partialize: (state) => ({ token: state.token, user: state.user }) }
  )
);
