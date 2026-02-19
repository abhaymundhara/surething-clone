import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useStore } from '../lib/store';

export default function Settings() {
  const { user } = useStore();
  const [health, setHealth] = useState<any>(null);
  const [connections, setConnections] = useState<any[]>([]);
  const [memories, setMemories] = useState<any[]>([]);

  useEffect(() => {
    api.health().then(setHealth).catch(console.error);
    api.getConnections().then(setConnections).catch(console.error);
    api.getMemories().then(setMemories).catch(console.error);
  }, []);

  const handleConnectGitHub = async () => {
    const { url } = await api.connectGitHub();
    window.open(url, '_blank');
  };

  const ghConn = connections.find(c => c.provider === 'github');

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="h-14 px-6 flex items-center border-b border-border bg-bg-card/50">
        <h2 className="font-semibold">Settings</h2>
      </div>

      <div className="px-6 py-6 space-y-6 max-w-2xl">
        {/* System Status */}
        <section className="bg-bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold mb-3">System Status</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex justify-between">
              <span className="text-fg-muted">Server</span>
              <span className={health?.server === 'ok' ? 'text-green-400' : 'text-red-400'}>
                {health?.server || '...'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-fg-muted">LLM</span>
              <span className={health?.llm?.running ? 'text-green-400' : 'text-red-400'}>
                {health?.llm?.running ? 'Connected' : 'Offline'}
              </span>
            </div>
          </div>
        </section>

        {/* GitHub Connection */}
        <section className="bg-bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold mb-3">GitHub Connection</h3>
          {ghConn ? (
            <div className="flex items-center gap-3">
              <span className="text-green-400">●</span>
              <span>Connected as <strong>{(ghConn.metadata as any)?.login}</strong></span>
            </div>
          ) : (
            <button onClick={handleConnectGitHub}
              className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition">
              Connect GitHub
            </button>
          )}
        </section>

        {/* User Profile */}
        <section className="bg-bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold mb-3">Profile</h3>
          <div className="text-sm space-y-2">
            <div><span className="text-fg-muted">Email:</span> {user?.email}</div>
            <div><span className="text-fg-muted">Name:</span> {user?.name || 'Not set'}</div>
          </div>
        </section>

        {/* Memories */}
        <section className="bg-bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold mb-3">Agent Memories ({memories.length})</h3>
          {memories.length === 0 && <p className="text-fg-muted text-sm">No memories saved yet</p>}
          <div className="space-y-2">
            {memories.map((m: any) => (
              <div key={m.id} className="text-sm">
                <span className="text-accent font-mono text-xs">[{m.category}]</span> {m.content}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
