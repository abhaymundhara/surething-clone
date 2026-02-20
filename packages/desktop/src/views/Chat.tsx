import { useState, useEffect, useRef } from "react";
import { useStore } from "../lib/store";
import { api } from "../lib/api";
import MessageBubble from "../components/MessageBubble";
import ApprovalCard from "../components/ApprovalCard";
import { Send, Paperclip, Plus, MessageSquarePlus } from "lucide-react";

export default function Chat() {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const {
    messages,
    setMessages,
    addMessage,
    conversations,
    setConversations,
    currentConversationId,
    currentCellId,
    setCurrentConversation,
    tasks,
    addToast,
  } = useStore();

  // Load conversations on mount
  useEffect(() => {
    api
      .getConversations()
      .then((convs) => {
        setConversations(convs);
        if (convs.length > 0 && !currentConversationId) {
          setCurrentConversation(convs[0].id, convs[0].cellId);
        }
      })
      .catch(() => addToast("Failed to load conversations", "error"));
  }, []);

  // Load messages when conversation changes
  useEffect(() => {
    if (!currentConversationId) {
      setMessages([]);
      return;
    }
    api
      .getMessages(currentConversationId)
      .then((msgs) => setMessages(msgs))
      .catch(() => addToast("Failed to load messages", "error"));
  }, [currentConversationId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input
  useEffect(() => {
    inputRef.current?.focus();
  }, [currentConversationId]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;

    let convId = currentConversationId;

    // Create new conversation if none selected
    if (!convId) {
      try {
        const conv = await api.createConversation();
        convId = conv.id;
        setCurrentConversation(conv.id, conv.cellId ?? null);
        setConversations([conv, ...conversations]);
      } catch {
        addToast("Failed to create conversation", "error");
        return;
      }
    }

    setInput("");
    setSending(true);

    // Optimistic message
    const tempMsg = {
      id: `temp-${Date.now()}`,
      conversationId: convId,
      role: "user" as const,
      content: text,
      createdAt: new Date().toISOString(),
    };
    addMessage(tempMsg);

    try {
      const response = await api.sendMessage(convId, text);
      // Server returns the saved message; the WS handler will also push it
      // The store's addMessage deduplicates by removing temp messages
    } catch (err: any) {
      addToast(err.message || "Failed to send message", "error");
      // Remove the optimistic message on error
      useStore
        .getState()
        .setMessages(
          useStore.getState().messages.filter((m) => m.id !== tempMsg.id),
        );
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewConversation = async () => {
    try {
      const conv = await api.createConversation();
      setCurrentConversation(conv.id, conv.cellId ?? null);
      setConversations([conv, ...conversations]);
      setMessages([]);
    } catch {
      addToast("Failed to create conversation", "error");
    }
  };

  const handleFileDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    for (const file of droppedFiles) {
      try {
        await api.uploadFile(file, currentCellId ?? undefined);
        addToast(`Uploaded: ${file.name}`, "success");
      } catch (err: any) {
        addToast(`Upload failed: ${file.name}`, "error");
      }
    }
  };

  // Find HITL tasks for this conversation/cell
  const hitlTasks = tasks.filter(
    (t) => t.status === "awaiting_user_action" && t.cellId === currentCellId,
  );

  return (
    <div
      className="h-full flex flex-col"
      onDragOver={(e) => {
        e.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        if (e.currentTarget === e.target) setDragActive(false);
      }}
      onDrop={handleFileDrop}
    >
      {/* Header */}
      <header className="flex items-center justify-between px-4 h-14 border-b border-border shrink-0 bg-bg-card">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-medium text-fg">
            {currentConversationId ? "Chat" : "No conversation selected"}
          </h2>
        </div>
        <button
          onClick={handleNewConversation}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-bg-hover hover:bg-border text-fg-muted rounded-lg transition-colors"
        >
          <MessageSquarePlus className="w-3.5 h-3.5" />
          New
        </button>
      </header>

      {/* Conversation list (horizontal tabs when there are multiple) */}
      {conversations.length > 1 && (
        <div className="flex gap-1 px-3 py-2 border-b border-border overflow-x-auto bg-bg">
          {conversations.slice(0, 10).map((conv) => (
            <button
              key={conv.id}
              onClick={() => setCurrentConversation(conv.id, conv.cellId)}
              className={`px-3 py-1 rounded-lg text-xs whitespace-nowrap transition-colors ${
                conv.id === currentConversationId
                  ? "bg-accent/10 text-accent"
                  : "text-fg-muted hover:bg-bg-hover"
              }`}
            >
              {new Date(conv.createdAt).toLocaleDateString()}
            </button>
          ))}
        </div>
      )}

      {/* Messages */}
      <div
        className={`flex-1 overflow-y-auto px-4 py-4 ${dragActive ? "ring-2 ring-accent ring-inset rounded-lg" : ""}`}
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-fg-dim">
            <MessageSquarePlus className="w-10 h-10 mb-3 opacity-40" />
            <p className="text-sm">Start a conversation</p>
            <p className="text-xs mt-1">
              Type a message or drag and drop a file
            </p>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                role={msg.role}
                content={msg.content}
                createdAt={msg.createdAt}
                citations={msg.metadata?.citations}
                reactions={msg.metadata?.reactions}
              />
            ))}

            {/* Inline approval cards */}
            {hitlTasks.map((task) => (
              <ApprovalCard
                key={task.id}
                taskId={task.id}
                title={task.title}
                whyHuman={task.actionContext?.whyHuman}
                draftContent={task.actionContext?.draftContent}
                draftType={task.actionContext?.draftType}
              />
            ))}

            <div ref={messagesEndRef} />
          </>
        )}

        {dragActive && (
          <div className="absolute inset-0 flex items-center justify-center bg-bg/80 backdrop-blur-sm z-10">
            <div className="flex flex-col items-center gap-2 text-accent">
              <Paperclip className="w-8 h-8" />
              <span className="text-sm font-medium">Drop files to upload</span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-4 pb-4 pt-2 border-t border-border bg-bg">
        <div className="flex items-end gap-2 bg-bg-card border border-border rounded-xl px-3 py-2 focus-within:border-accent transition-colors">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message... (Shift+Enter for new line)"
            rows={1}
            className="flex-1 bg-transparent text-fg text-sm placeholder:text-fg-dim resize-none outline-none max-h-32"
            style={{ minHeight: "24px" }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="p-1.5 rounded-lg bg-accent hover:bg-accent-hover text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
