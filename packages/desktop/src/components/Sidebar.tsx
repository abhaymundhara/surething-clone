import { useStore } from '../lib/store';

interface SidebarProps {
  currentView: string;
  onViewChange: (view: any) => void;
}

const navItems = [
  { id: 'chat', label: 'Chat', icon: '💬' },
  { id: 'tasks', label: 'Tasks', icon: '✅' },
  { id: 'files', label: 'Files', icon: '📁' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
];

export default function Sidebar({ currentView, onViewChange }: SidebarProps) {
  const { user, logout } = useStore();

  return (
    <div className="w-16 bg-bg-card border-r border-border flex flex-col items-center py-4 gap-2">
      <div className="text-2xl mb-4">🧠</div>

      {navItems.map((item) => (
        <button
          key={item.id}
          onClick={() => onViewChange(item.id)}
          className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg transition
            ${currentView === item.id ? 'bg-accent text-white' : 'hover:bg-bg-hover text-fg-muted'}`}
          title={item.label}
        >
          {item.icon}
        </button>
      ))}

      <div className="flex-1" />

      <button onClick={logout} className="w-10 h-10 rounded-lg flex items-center justify-center text-lg hover:bg-bg-hover text-fg-muted" title="Logout">
        🚪
      </button>
    </div>
  );
}
