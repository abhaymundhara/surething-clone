import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';

interface Citation {
  index: number;
  type: string;
  name: string;
  url?: string;
}

interface MessageBubbleProps {
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  citations?: Citation[];
  reactions?: { emoji: string; userId: string }[];
}

export default function MessageBubble({ role, content, createdAt, citations, reactions }: MessageBubbleProps) {
  const isUser = role === 'user';

  // Group reactions by emoji
  const reactionCounts = (reactions || []).reduce<Record<string, number>>((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] || 0) + 1;
    return acc;
  }, {});

  const emojiMap: Record<string, string> = {
    thumbs_up: '👍', thumbs_down: '👎', heart: '❤️', smile: '😊',
    thinking: '🤔', celebrate: '🎉', clap: '👏', sad: '😢', fire: '🔥', pray: '🙏',
  };

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3 group`}>
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

        {/* Citations */}
        {citations && citations.length > 0 && (
          <div className="mt-2 pt-2 border-t border-border/30">
            <div className="flex flex-wrap gap-1.5">
              {citations.map((c) => (
                <span key={c.index} className="text-xs px-1.5 py-0.5 rounded bg-bg/30 text-fg-muted">
                  {c.url ? (
                    <a href={c.url} target="_blank" rel="noopener" className="hover:text-accent">[^{c.index}] {c.name}</a>
                  ) : (
                    <>[^{c.index}] {c.name}</>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Reactions */}
        {Object.keys(reactionCounts).length > 0 && (
          <div className="flex gap-1 mt-1.5">
            {Object.entries(reactionCounts).map(([emoji, count]) => (
              <span key={emoji} className="text-xs px-1.5 py-0.5 rounded-full bg-bg/30">
                {emojiMap[emoji] || emoji} {count > 1 && count}
              </span>
            ))}
          </div>
        )}

        <div className={`text-xs mt-1 ${isUser ? 'text-indigo-200' : 'text-fg-muted'}`}>
          {new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
}
