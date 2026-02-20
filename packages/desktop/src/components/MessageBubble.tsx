import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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

const EMOJI_MAP: Record<string, string> = {
  thumbs_up: '👍', thumbs_down: '👎', heart: '❤️', smile: '😊',
  thinking: '🤔', celebrate: '🎉', clap: '👏', sad: '😢', fire: '🔥', pray: '🙏',
};

export default function MessageBubble({ role, content, createdAt, citations, reactions }: MessageBubbleProps) {
  const isUser = role === 'user';
  const isSystem = role === 'system';

  // Group reactions by emoji
  const reactionCounts = (reactions || []).reduce<Record<string, number>>((acc, r) => {
    const emoji = EMOJI_MAP[r.emoji] || r.emoji;
    acc[emoji] = (acc[emoji] || 0) + 1;
    return acc;
  }, {});

  if (isSystem) {
    return (
      <div className="flex justify-center mb-3">
        <span className="text-xs text-fg-dim bg-bg-hover px-3 py-1 rounded-full">{content}</span>
      </div>
    );
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3 group`}>
      <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
        isUser
          ? 'bg-accent text-white rounded-br-sm'
          : 'bg-bg-card border border-border rounded-bl-sm'
      }`}>
        <div className={`prose prose-sm max-w-none ${isUser ? 'prose-invert' : 'prose-invert'}`}>
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
            {content}
          </ReactMarkdown>
        </div>

        {/* Citations */}
        {citations && citations.length > 0 && (
          <div className="mt-2 pt-2 border-t border-white/10">
            <div className="flex flex-wrap gap-1.5">
              {citations.map((c) => (
                <span key={c.index} className="text-[11px] px-2 py-0.5 rounded-full bg-white/10 text-fg-muted">
                  {c.url ? (
                    <a href={c.url} target="_blank" rel="noopener noreferrer" className="hover:text-accent no-underline">
                      [{c.index}] {c.name}
                    </a>
                  ) : (
                    <>[{c.index}] {c.name}</>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Reactions */}
        {Object.keys(reactionCounts).length > 0 && (
          <div className="flex gap-1 mt-2">
            {Object.entries(reactionCounts).map(([emoji, count]) => (
              <span key={emoji} className="text-xs px-1.5 py-0.5 rounded-full bg-white/10 cursor-default">
                {emoji}{count > 1 ? ` ${count}` : ''}
              </span>
            ))}
          </div>
        )}

        <div className={`text-[11px] mt-1.5 ${isUser ? 'text-white/50' : 'text-fg-dim'}`}>
          {new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
}
