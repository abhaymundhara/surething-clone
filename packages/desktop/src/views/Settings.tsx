import { useEffect, useState } from 'react';
import { useStore } from '../lib/store';
import { api } from '../lib/api';
import { Github, LogOut, RefreshCw, Loader2, User, Zap, ExternalLink } from 'lucide-react';

interface Connection {
  id: string;
  provider: string;
  status: string;
  metadata?: { login?: string };
  createdAt: string;
}

export default function Settings() {
  const { user, logout, addToast } = useStore();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  const loadConnections = () => {
    api.getConnections()
      .then(c => { setConnections(c); setLoading(false); })
      .catch(() => { addToast('Failed to load connections', 'error'); setLoading(false); });
  };

  useEffect(() => { loadConnections(); }, []);

  // Poll for new connections (in case OAuth completed in another tab)
  useEffect(() => {
    if (!connecting) return;
    const interval = setInterval(() => {
      api.getConnections().then(c => {
        const active = c.filter((conn: Connection) => conn.status === 'active');
        if (active.length > connections.filter(conn => conn.status === 'active').length) {
          setConnections(c);
          setConnecting(false);
          addToast('GitHub connected!', 'success');
        }
      }).catch(() => {});
    }, 3000);
    return () => clearInterval(interval);
  }, [connecting, connections]);

  const handleConnectGitHub = async () => {
    try {
      setConnecting(true);
      const result = await api.initiateGitHubAuth();
      window.open(result.url, '_blank');
      addToast('Complete GitHub authorization in the new tab', 'info');
    } catch (err: any) {
      setConnecting(false);
      addToast(err.message || 'Failed to start GitHub auth', 'error');
    }
  };

  const handleDisconnect = async (connId: string) => {
    try {
      await api.disconnectConnection(connId);
      addToast('Disconnected', 'info');
      loadConnections();
    } catch {
      addToast('Failed to disconnect', 'error');
    }
  };

  const githubConn = connections.find(c => c.provider === 'github' && c.status === 'active');

  return (
    <div className="h-full flex flex-col">
      <header className="flex items-center px-4 h-14 border-b border-border bg-bg-card shrink-0">
        <h2 className="text-sm font-medium text-fg">Settings</h2>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-8 max-w-2xl">
        {/* Profile */}
        <section>
          <h3 className="text-sm font-medium text-fg mb-3 flex items-center gap-2">
            <User className="w-4 h-4" /> Profile
          </h3>
          <div className="bg-bg-card border border-border rounded-xl p-4">
            {user ? (
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-xs text-fg-muted">Name</span>
                  <span className="text-sm text-fg">{user.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-fg-muted">Email</span>
                  <span className="text-sm text-fg">{user.email}</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-fg-muted">Loading...</p>
            )}
          </div>
        </section>

        {/* Connections */}
        <section>
          <h3 className="text-sm font-medium text-fg mb-3 flex items-center gap-2">
            <Zap className="w-4 h-4" /> Connections
          </h3>
          <div className="bg-bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Github className="w-5 h-5 text-fg" />
                <div>
                  <p className="text-sm text-fg">GitHub</p>
                  {githubConn ? (
                    <p className="text-xs text-success">Connected as @{githubConn.metadata?.login || 'unknown'}</p>
                  ) : (
                    <p className="text-xs text-fg-dim">Not connected</p>
                  )}
                </div>
              </div>
              {githubConn ? (
                <button
                  onClick={() => handleDisconnect(githubConn.id)}
                  className="px-3 py-1.5 text-xs text-danger hover:bg-danger/10 rounded-lg transition-colors"
                >
                  Disconnect
                </button>
              ) : (
                <button
                  onClick={handleConnectGitHub}
                  disabled={connecting}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-accent hover:bg-accent-hover text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {connecting ? (
                    <><Loader2 className="w-3 h-3 animate-spin" /> Waiting...</>
                  ) : (
                    <><ExternalLink className="w-3 h-3" /> Connect</>
                  )}
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Logout */}
        <section>
          <button
            onClick={logout}
            className="flex items-center gap-2 px-4 py-2 text-sm text-danger hover:bg-danger/10 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </section>
      </div>
    </div>
  );
}
