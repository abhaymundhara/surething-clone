import { useEffect, useState } from 'react';
import { useStore } from '../lib/store';
import { api } from '../lib/api';
import { CheckCircle, Clock, AlertCircle, Pause, X, RotateCcw, Loader2 } from 'lucide-react';

type Filter = 'all' | 'pending' | 'in_progress' | 'awaiting_user_action' | 'completed' | 'failed' | 'paused' | 'skipped';

const STATUS_CONFIG: Record<string, { icon: typeof Clock; color: string; label: string }> = {
  pending: { icon: Clock, color: 'text-fg-muted', label: 'Pending' },
  in_progress: { icon: Loader2, color: 'text-accent', label: 'Running' },
  awaiting_user_action: { icon: AlertCircle, color: 'text-warning', label: 'Needs Action' },
  completed: { icon: CheckCircle, color: 'text-success', label: 'Done' },
  failed: { icon: X, color: 'text-danger', label: 'Failed' },
  paused: { icon: Pause, color: 'text-fg-dim', label: 'Paused' },
  skipped: { icon: RotateCcw, color: 'text-fg-dim', label: 'Skipped' },
};

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'awaiting_user_action', label: 'Needs Action' },
  { id: 'pending', label: 'Pending' },
  { id: 'in_progress', label: 'Running' },
  { id: 'completed', label: 'Done' },
  { id: 'failed', label: 'Failed' },
];

export default function Tasks() {
  const { tasks, setTasks, addToast } = useStore();
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getTasks()
      .then(t => { setTasks(t); setLoading(false); })
      .catch(() => { addToast('Failed to load tasks', 'error'); setLoading(false); });
  }, []);

  const filtered = filter === 'all' ? tasks : tasks.filter(t => t.status === filter);

  return (
    <div className="h-full flex flex-col">
      <header className="flex items-center justify-between px-4 h-14 border-b border-border bg-bg-card shrink-0">
        <h2 className="text-sm font-medium text-fg">Tasks</h2>
        <span className="text-xs text-fg-dim">{tasks.length} total</span>
      </header>

      {/* Filters */}
      <div className="flex gap-1 px-4 py-3 border-b border-border overflow-x-auto">
        {FILTERS.map(f => {
          const count = f.id === 'all' ? tasks.length : tasks.filter(t => t.status === f.id).length;
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-colors ${
                filter === f.id
                  ? 'bg-accent/10 text-accent font-medium'
                  : 'text-fg-muted hover:bg-bg-hover'
              }`}
            >
              {f.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-5 h-5 text-fg-muted animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-fg-dim">
            <CheckCircle className="w-8 h-8 mb-2 opacity-40" />
            <p className="text-sm">No tasks {filter !== 'all' ? `with status "${filter}"` : ''}</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map(task => {
              const config = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending;
              const Icon = config.icon;
              return (
                <div key={task.id} className="flex items-center gap-3 px-4 py-3 hover:bg-bg-hover/50 transition-colors">
                  <Icon className={`w-4 h-4 shrink-0 ${config.color} ${task.status === 'in_progress' ? 'animate-spin' : ''}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-fg truncate">{task.title}</p>
                    <p className="text-[11px] text-fg-dim mt-0.5">
                      {config.label} · {task.executor === 'human' ? '👤 Human' : '🤖 AI'} · {new Date(task.createdAt).toLocaleString()}
                    </p>
                  </div>
                  {task.status === 'awaiting_user_action' && (
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        onClick={async () => {
                          try {
                            await api.approveTask(task.id);
                            addToast('Task approved', 'success');
                          } catch { addToast('Failed', 'error'); }
                        }}
                        className="px-2.5 py-1 text-xs bg-accent hover:bg-accent-hover text-white rounded-md"
                      >
                        Approve
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            await api.rejectTask(task.id);
                            addToast('Task rejected', 'info');
                          } catch { addToast('Failed', 'error'); }
                        }}
                        className="px-2.5 py-1 text-xs bg-bg-hover hover:bg-border text-fg-muted rounded-md"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
