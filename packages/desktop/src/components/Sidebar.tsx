import { useStore } from '../lib/store';
import {
  MessageSquare, CheckSquare, FolderOpen, Settings, Zap,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useState } from 'react';

type View = 'chat' | 'tasks' | 'files' | 'settings';

const navItems: { id: View; icon: typeof MessageSquare; label: string; shortcut: string }[] = [
  { id: 'chat', icon: MessageSquare, label: 'Chat', shortcut: '⌘1' },
  { id: 'tasks', icon: CheckSquare, label: 'Tasks', shortcut: '⌘2' },
  { id: 'files', icon: FolderOpen, label: 'Files', shortcut: '⌘3' },
  { id: 'settings', icon: Settings, label: 'Settings', shortcut: '⌘,' },
];

export default function Sidebar() {
  const currentView = useStore(s => s.currentView);
  const setView = useStore(s => s.setView);
  const isConnected = useStore(s => s.isConnected);
  const tasks = useStore(s => s.tasks);
  const [expanded, setExpanded] = useState(true);

  const pendingCount = tasks.filter(t => t.status === 'awaiting_user_action').length;

  return (
    <aside className={`h-full flex flex-col bg-bg-card border-r border-border transition-all duration-200 ${
      expanded ? 'w-52' : 'w-14'
    }`}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 h-14 border-b border-border shrink-0">
        <Zap className="w-5 h-5 text-accent shrink-0" />
        {expanded && <span className="font-semibold text-fg text-sm truncate">SureThing</span>}
        <button
          onClick={() => setExpanded(!expanded)}
          className="ml-auto p-1 rounded hover:bg-bg-hover text-fg-muted"
        >
          {expanded ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-2 px-2 space-y-1">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          const badge = item.id === 'tasks' && pendingCount > 0 ? pendingCount : null;

          return (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`w-full flex items-center gap-3 px-2 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-accent/10 text-accent'
                  : 'text-fg-muted hover:bg-bg-hover hover:text-fg'
              }`}
              title={!expanded ? `${item.label} (${item.shortcut})` : undefined}
            >
              <Icon className="w-4.5 h-4.5 shrink-0" />
              {expanded && (
                <>
                  <span className="truncate">{item.label}</span>
                  {badge && (
                    <span className="ml-auto bg-accent text-white text-xs px-1.5 py-0.5 rounded-full">
                      {badge}
                    </span>
                  )}
                  <span className="ml-auto text-xs text-fg-dim">{item.shortcut}</span>
                </>
              )}
              {!expanded && badge && (
                <span className="absolute ml-6 -mt-4 bg-danger text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full">
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Connection status */}
      <div className="px-3 py-3 border-t border-border">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-success' : 'bg-danger animate-pulse-dot'}`} />
          {expanded && (
            <span className="text-xs text-fg-dim">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          )}
        </div>
      </div>
    </aside>
  );
}
