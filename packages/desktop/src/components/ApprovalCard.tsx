import { api } from '../lib/api';

interface ApprovalCardProps {
  task: {
    id: string;
    title: string;
    whyHuman?: string;
    actionContext?: Record<string, unknown>;
  };
  onAction: () => void;
}

export default function ApprovalCard({ task, onAction }: ApprovalCardProps) {
  const handleApprove = async () => {
    await api.approveTask(task.id);
    onAction();
  };

  const handleReject = async () => {
    await api.rejectTask(task.id);
    onAction();
  };

  return (
    <div className="bg-bg-card border border-border rounded-xl p-4 mb-3 max-w-md">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">📋</span>
        <span className="font-medium text-fg">{task.title}</span>
      </div>
      {task.whyHuman && (
        <p className="text-sm text-fg-muted mb-3">{task.whyHuman}</p>
      )}
      <div className="flex gap-2">
        <button onClick={handleApprove}
          className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition">
          ✓ Approve
        </button>
        <button onClick={handleReject}
          className="flex-1 py-2 bg-bg-hover hover:bg-border text-fg rounded-lg text-sm font-medium transition">
          ✗ Cancel
        </button>
      </div>
    </div>
  );
}
