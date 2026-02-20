import { useState } from 'react';
import { api } from '../lib/api';
import { useStore } from '../lib/store';
import { Check, X, Loader2 } from 'lucide-react';

interface ApprovalCardProps {
  taskId: string;
  title: string;
  whyHuman?: string;
  draftContent?: string;
  draftType?: string;
}

export default function ApprovalCard({ taskId, title, whyHuman, draftContent, draftType }: ApprovalCardProps) {
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null);
  const [resolved, setResolved] = useState<'approved' | 'rejected' | null>(null);
  const addToast = useStore(s => s.addToast);

  const handleAction = async (action: 'approve' | 'reject') => {
    setLoading(action);
    try {
      if (action === 'approve') {
        await api.approveTask(taskId);
        setResolved('approved');
        addToast('Task approved', 'success');
      } else {
        await api.rejectTask(taskId);
        setResolved('rejected');
        addToast('Task rejected', 'info');
      }
    } catch (err: any) {
      addToast(err.message || 'Action failed', 'error');
    } finally {
      setLoading(null);
    }
  };

  if (resolved) {
    return (
      <div className="my-2 mx-4 p-4 rounded-xl bg-bg-card border border-border">
        <div className="flex items-center gap-2 text-sm">
          {resolved === 'approved' ? (
            <><Check className="w-4 h-4 text-success" /><span className="text-fg-muted">Approved: {title}</span></>
          ) : (
            <><X className="w-4 h-4 text-danger" /><span className="text-fg-muted">Rejected: {title}</span></>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="my-2 mx-4 p-4 rounded-xl bg-bg-card border border-accent/20 shadow-lg shadow-accent/5">
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <span className="text-[11px] uppercase tracking-wider text-accent font-medium">
            {draftType === 'email' ? '📧 Email Draft' : draftType === 'calendar' ? '📅 Calendar Invite' : '⚡ Action Required'}
          </span>
          <h3 className="text-sm font-medium text-fg mt-0.5">{title}</h3>
        </div>
      </div>

      {whyHuman && (
        <p className="text-xs text-fg-muted mb-3">{whyHuman}</p>
      )}

      {/* Draft preview */}
      {draftContent && (
        <div className="mb-3 p-3 rounded-lg bg-bg text-xs text-fg-muted max-h-40 overflow-y-auto border border-border">
          <pre className="whitespace-pre-wrap font-sans">{draftContent}</pre>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => handleAction('approve')}
          disabled={!!loading}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          {loading === 'approve' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          Approve
        </button>
        <button
          onClick={() => handleAction('reject')}
          disabled={!!loading}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-bg-hover hover:bg-border text-fg-muted rounded-lg text-sm transition-colors disabled:opacity-50"
        >
          {loading === 'reject' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
          Reject
        </button>
      </div>
    </div>
  );
}
