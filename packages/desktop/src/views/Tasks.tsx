import { useState, useEffect } from 'react';
import { api } from '../lib/api';

export default function Tasks() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => { loadTasks(); }, []);

  const loadTasks = async () => {
    try { setTasks(await api.getTasks()); } catch (e) { console.error(e); }
  };

  const filtered = filter === 'all' ? tasks : tasks.filter(t => t.status === filter);

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-400',
    in_progress: 'bg-blue-500/20 text-blue-400',
    completed: 'bg-green-500/20 text-green-400',
    failed: 'bg-red-500/20 text-red-400',
    skipped: 'bg-gray-500/20 text-gray-400',
    awaiting_user_action: 'bg-purple-500/20 text-purple-400',
    paused: 'bg-orange-500/20 text-orange-400',
  };

  return (
    <div className="flex flex-col h-full">
      <div className="h-14 px-6 flex items-center border-b border-border bg-bg-card/50">
        <h2 className="font-semibold">Tasks</h2>
        <div className="ml-auto flex gap-2">
          {['all', 'pending', 'completed', 'awaiting_user_action'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-lg text-xs ${filter === f ? 'bg-accent text-white' : 'bg-bg-hover text-fg-muted'}`}>
              {f === 'all' ? 'All' : f.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {filtered.length === 0 && <p className="text-fg-muted text-center mt-8">No tasks found</p>}
        {filtered.map((task) => (
          <div key={task.id} className="bg-bg-card border border-border rounded-xl p-4 mb-3">
            <div className="flex items-center gap-3">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[task.status] || ''}`}>
                {task.status}
              </span>
              <span className="font-medium">{task.title}</span>
              <span className="ml-auto text-xs text-fg-muted">{task.executor}</span>
            </div>
            {task.status === 'awaiting_user_action' && (
              <div className="flex gap-2 mt-3">
                <button onClick={() => api.approveTask(task.id).then(loadTasks)}
                  className="px-4 py-1.5 bg-green-600 text-white rounded-lg text-sm">Approve</button>
                <button onClick={() => api.rejectTask(task.id).then(loadTasks)}
                  className="px-4 py-1.5 bg-bg-hover text-fg rounded-lg text-sm">Reject</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
