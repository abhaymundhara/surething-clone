import { useState } from 'react';
import Chat from './views/Chat';
import Tasks from './views/Tasks';
import Files from './views/Files';
import Settings from './views/Settings';
import Sidebar from './components/Sidebar';
import { useStore } from './lib/store';

type View = 'chat' | 'tasks' | 'files' | 'settings';

export default function App() {
  const [view, setView] = useState<View>('chat');
  const { token } = useStore();

  if (!token) {
    return <Login />;
  }

  return (
    <div className="flex h-screen bg-bg">
      <Sidebar currentView={view} onViewChange={setView} />
      <main className="flex-1 flex flex-col overflow-hidden">
        {view === 'chat' && <Chat />}
        {view === 'tasks' && <Tasks />}
        {view === 'files' && <Files />}
        {view === 'settings' && <Settings />}
      </main>
    </div>
  );
}

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const { setToken, setUser } = useStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const endpoint = isRegistering ? '/api/auth/register' : '/api/auth/login';
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setToken(data.data.token);
      setUser(data.data.user);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-bg">
      <form onSubmit={handleSubmit} className="w-96 p-8 bg-bg-card rounded-xl border border-border">
        <h1 className="text-2xl font-bold mb-1">🧠 SureThing Clone</h1>
        <p className="text-fg-muted text-sm mb-6">Autonomous AI Agent Platform</p>
        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
        <input
          type="email" value={email} onChange={e => setEmail(e.target.value)}
          placeholder="Email" required
          className="w-full px-4 py-3 bg-bg rounded-lg border border-border text-fg mb-3 focus:border-accent outline-none"
        />
        <input
          type="password" value={password} onChange={e => setPassword(e.target.value)}
          placeholder="Password" required
          className="w-full px-4 py-3 bg-bg rounded-lg border border-border text-fg mb-4 focus:border-accent outline-none"
        />
        <button type="submit" className="w-full py-3 bg-accent hover:bg-accent-hover text-white rounded-lg font-medium transition">
          {isRegistering ? 'Create Account' : 'Sign In'}
        </button>
        <button type="button" onClick={() => setIsRegistering(!isRegistering)}
          className="w-full mt-3 text-sm text-fg-muted hover:text-fg transition">
          {isRegistering ? 'Already have an account? Sign in' : 'Need an account? Register'}
        </button>
      </form>
    </div>
  );
}
