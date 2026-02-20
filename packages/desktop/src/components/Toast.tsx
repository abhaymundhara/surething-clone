import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info';
  onClose: () => void;
}

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
};

const colors = {
  success: 'border-success/30 bg-success/10',
  error: 'border-danger/30 bg-danger/10',
  info: 'border-accent/30 bg-accent/10',
};

export default function Toast({ message, type, onClose }: ToastProps) {
  const Icon = icons[type];

  return (
    <div className={`animate-slide-in flex items-center gap-3 px-4 py-3 rounded-lg border ${colors[type]} backdrop-blur-sm shadow-lg max-w-sm`}>
      <Icon className="w-4 h-4 shrink-0" />
      <span className="text-sm text-fg flex-1">{message}</span>
      <button onClick={onClose} className="text-fg-muted hover:text-fg">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
