import { useEffect, useState } from "react";
import { useStore } from "./lib/store";
import { api } from "./lib/api";
import { connectWebSocket, disconnectWebSocket } from "./lib/websocket";
import Sidebar from "./components/Sidebar";
import Chat from "./views/Chat";
import Tasks from "./views/Tasks";
import Files from "./views/Files";
import Settings from "./views/Settings";
import Toast from "./components/Toast";

function LoginView() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const setAuth = useStore((s) => s.setAuth);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = isRegister
        ? await api.register(name, email, password)
        : await api.login(email, password);
      setAuth(data.token, data.user);
    } catch (err: any) {
      setError(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex items-center justify-center bg-bg">
      <div className="w-full max-w-sm p-8 bg-bg-card border border-border rounded-xl">
        <h1 className="text-xl font-bold text-fg mb-1">SureThing Clone</h1>
        <p className="text-fg-muted text-sm mb-6">
          {isRegister ? "Create your account" : "Sign in to continue"}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <input
              type="text"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-fg placeholder:text-fg-dim focus:outline-none focus:border-accent"
              required
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-fg placeholder:text-fg-dim focus:outline-none focus:border-accent"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-fg placeholder:text-fg-dim focus:outline-none focus:border-accent"
            required
          />

          {error && <p className="text-danger text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-accent hover:bg-accent-hover text-white rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {loading
              ? "Please wait..."
              : isRegister
                ? "Create Account"
                : "Sign In"}
          </button>
        </form>

        <button
          onClick={() => {
            setIsRegister(!isRegister);
            setError("");
          }}
          className="mt-4 text-sm text-fg-muted hover:text-fg transition-colors w-full text-center"
        >
          {isRegister
            ? "Already have an account? Sign in"
            : "Don't have an account? Register"}
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const token = useStore((s) => s.token);
  const user = useStore((s) => s.user);
  const currentView = useStore((s) => s.currentView);
  const toasts = useStore((s) => s.toasts);
  const removeToast = useStore((s) => s.removeToast);
  const setAuth = useStore((s) => s.setAuth);
  const logout = useStore((s) => s.logout);

  // Load profile on mount if token exists
  useEffect(() => {
    if (token && !user) {
      api
        .getProfile()
        .then((data) => setAuth(token, data.user || data))
        .catch(() => logout());
    }
  }, [token]);

  // Connect WebSocket when authenticated
  useEffect(() => {
    if (token) {
      connectWebSocket();
      return () => disconnectWebSocket();
    }
  }, [token]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        switch (e.key) {
          case "1":
            e.preventDefault();
            useStore.getState().setView("chat");
            break;
          case "2":
            e.preventDefault();
            useStore.getState().setView("tasks");
            break;
          case "3":
            e.preventDefault();
            useStore.getState().setView("files");
            break;
          case ",":
            e.preventDefault();
            useStore.getState().setView("settings");
            break;
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  if (!token) return <LoginView />;

  const renderView = () => {
    switch (currentView) {
      case "chat":
        return <Chat />;
      case "tasks":
        return <Tasks />;
      case "files":
        return <Files />;
      case "settings":
        return <Settings />;
      default:
        return <Chat />;
    }
  };

  return (
    <div className="h-full flex bg-bg">
      <Sidebar />
      <main className="flex-1 min-w-0">{renderView()}</main>

      {/* Toast container */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map((t) => (
          <Toast
            key={t.id}
            message={t.message}
            type={t.type}
            onClose={() => removeToast(t.id)}
          />
        ))}
      </div>
    </div>
  );
}
