import { useState, useEffect, useRef } from 'react';
import { useStore } from '../lib/store';
import { api } from '../lib/api';
import { connectWebSocket } from '../lib/websocket';
import MessageBubble from '../components/MessageBubble';
import ApprovalCard from '../components/ApprovalCard';

export default function Chat() {
  const { messages, setMessages, tasks, setTasks, currentConversationId, setCurrentConversation } = useStore();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversations, setConversations] = useState<any[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    connectWebSocket();
    loadConversations();
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
    } catch (e) { console.error(e); }
  };

  const loadMessages = async () => {
    if (!currentConversationId) return;
    try {
      const data = await api.getMessages(currentConversationId);
      setMessages(data);
    } catch (e) { console.error(e); }
  };

  const loadTasks = async () => {
    try {
      const data = await api.getTasks();
      setTasks(data);
    } catch (e) { console.error(e); }
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    if (!currentConversationId) {
      const { conversation, cellId } = await api.createConversation('New Chat');
      setCurrentConversation(conversation.id, cellId);
    }

    const content = input.trim();
    setInput('');
    setLoading(true);

    try {
      await api.sendMessage(currentConversationId!, content);
      await loadMessages();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const pendingTasks = tasks.filter(t => t.status === 'awaiting_user_action');

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="h-14 px-6 flex items-center border-b border-border bg-bg-card/50">
        <h2 className="font-semibold">Agent Chat</h2>
        <div className="ml-auto text-sm text-fg-muted">
          {conversations.length} conversation(s)
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} role={msg.role} content={msg.content} createdAt={msg.createdAt} />
        ))}

        {pendingTasks.map((task) => (
          <ApprovalCard key={task.id} task={task as any} onAction={loadTasks} />
        ))}

        {loading && (
          <div className="flex justify-start mb-3">
            <div className="bg-bg-card border border-border rounded-2xl rounded-bl-md px-4 py-3 text-fg-muted">
              Thinking...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border bg-bg-card/50">
        <div className="flex gap-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Message the agent..."
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
  );
}
