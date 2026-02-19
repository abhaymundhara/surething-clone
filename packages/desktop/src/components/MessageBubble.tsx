import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';

interface MessageBubbleProps {
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
}

export default function MessageBubble({ role, content, createdAt }: MessageBubbleProps) {
  const isUser = role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
        isUser
          ? 'bg-accent text-white rounded-br-md'
          : 'bg-bg-card border border-border rounded-bl-md'
      }`}>
        <div className="prose prose-invert prose-sm max-w-none">
          <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
            {content}
          </ReactMarkdown>
        </div>
        <div className={`text-xs mt-1 ${isUser ? 'text-indigo-200' : 'text-fg-muted'}`}>
          {new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
}
