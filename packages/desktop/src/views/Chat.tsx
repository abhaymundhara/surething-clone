import { useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '../lib/store';
import { api } from '../lib/api';
import { connectWebSocket } from '../lib/websocket';
import MessageBubble from '../components/MessageBubble';
import ApprovalCard from '../components/ApprovalCard';
import Toast from '../components/Toast';

export default function Chat() {
  const { messages, setMessages, tasks, setTasks, currentConversationId, setCurrentConversation } = useStore();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversations, setConversations] = useState<any[]>([]);
  const [showConvList, setShowConvList] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    connectWebSocket();
    loadConversations();
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (currentConversationId) {
      loadMessages();
      loadTasks();
    }
  }, [currentConversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadConversations = async () => {
    try {
      const data = await api.getConversations();
      setConversations(data);
      if (data.length > 0 && !currentConversationId) {
        setCurrentConversation(data[0].id, data[0].cellId);
      }
    } catch (e) { showToast((e as Error).message, 'error'); }
  };

  const loadMessages = async () => {
    if (!currentConversationId) return;
    try {
      const data = await api.getMessages(currentConversationId);
      setMessages(data);
    } catch (e) { showToast((e as Error).message, 'error'); }
  };

  const loadTasks = async () => {
    try { setTasks(await api.getTasks()); } catch (e) { console.error(e); }
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    let convId = currentConversationId;

    if (!convId) {
      const { conversation, cellId } = await api.createConversation('New Chat');
      convId = conversation.id;
      setCurrentConversation(conversation.id, cellId);
      await loadConversations();
    }

    const content = input.trim();
    setInput('');
    setLoading(true);

    // Optimistic message
    const optimisticMsg = {
      id: `temp-${Date.now()}`,
      conversationId: convId!,
      role: 'user' as const,
      content,
      createdAt: new Date().toISOString(),
    };
    useStore.getState().addMessage(optimisticMsg);

    try {
      await api.sendMessage(convId!, content);
      await loadMessages();
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileUpload = async (file: File) => {
    try {
      setLoading(true);
      const result = await api.uploadFile(file, undefined);
      if (result.success) {
        showToast(`Uploaded ${file.name}`, 'success');
        // Send a message with the file reference
        if (currentConversationId) {
          await api.sendMessage(currentConversationId, `[Uploaded file: ${file.name}]`);
          await loadMessages();
        }
      }
    } catch (e) {
      showToast(`Upload failed: ${(e as Error).message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const files = Array.from(e.dataTransfer.files);
    for (const file of files) {
      await handleFileUpload(file);
    }
  }, [currentConversationId]);

  const handleNewConversation = async () => {
    const { conversation, cellId } = await api.createConversation('New Chat');
    setCurrentConversation(conversation.id, cellId);
    setMessages([]);
    await loadConversations();
    setShowConvList(false);
  };

  const pendingTasks = tasks.filter(t => t.status === 'awaiting_user_action');

  return (
    <div className="flex flex-col h-full"
      onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
      onDragLeave={() => setDragActive(false)}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div className="h-14 px-6 flex items-center border-b border-border bg-bg-card/50 gap-3">
        <button onClick={() => setShowConvList(!showConvList)}
          className="text-lg hover:bg-bg-hover rounded-lg p-1.5 transition">💬</button>
        <h2 className="font-semibold flex-1">
          {conversations.find(c => c.id === currentConversationId)?.cellName || 'Agent Chat'}
        </h2>
        <button onClick={handleNewConversation}
          className="px-3 py-1.5 text-sm bg-accent hover:bg-accent-hover text-white rounded-lg transition">
          + New
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Conversation Sidebar */}
        {showConvList && (
          <div className="w-64 border-r border-border bg-bg-card/50 overflow-y-auto">
            {conversations.map((conv) => (
              <button key={conv.id}
                onClick={() => { setCurrentConversation(conv.id, conv.cellId); setShowConvList(false); }}
                className={`w-full px-4 py-3 text-left text-sm border-b border-border hover:bg-bg-hover transition
                  ${conv.id === currentConversationId ? 'bg-accent/10 border-l-2 border-l-accent' : ''}`}>
                <div className="font-medium truncate">{conv.cellName || 'Untitled'}</div>
                <div className="text-xs text-fg-muted">{new Date(conv.createdAt).toLocaleDateString()}</div>
              </button>
            ))}
          </div>
        )}

        {/* Messages */}
        <div className={`flex-1 flex flex-col ${dragActive ? 'bg-accent/5 border-2 border-dashed border-accent' : ''}`}>
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {messages.length === 0 && !loading && (
              <div className="text-center mt-16">
                <p className="text-4xl mb-4">🧠</p>
                <p className="text-fg-muted">Send a message to start chatting with the agent</p>
                <p className="text-xs text-fg-muted mt-2">Drop files here to upload</p>
              </div>
            )}

            {messages.map((msg) => (
              <MessageBubble key={msg.id} role={msg.role} content={msg.content} createdAt={msg.createdAt} />
            ))}

            {pendingTasks.map((task) => (
              <ApprovalCard key={task.id} task={task as any} onAction={loadTasks} />
            ))}

            {loading && (
              <div className="flex justify-start mb-3">
                <div className="bg-bg-card border border-border rounded-2xl rounded-bl-md px-4 py-3 text-fg-muted animate-pulse">
                  Thinking...
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-border bg-bg-card/50">
            <div className="flex gap-3 items-center">
              <button onClick={() => fileInputRef.current?.click()}
                className="p-2.5 text-fg-muted hover:text-fg hover:bg-bg-hover rounded-lg transition" title="Attach file">
                📎
              </button>
              <input ref={fileInputRef} type="file" className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])} />
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Message the agent... (Enter to send)"
                className="flex-1 px-4 py-3 bg-bg rounded-xl border border-border text-fg focus:border-accent outline-none"
              />
              <button
                onClick={handleSend}
                disabled={loading || !input.trim()}
                className="px-6 py-3 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white rounded-xl font-medium transition"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}
