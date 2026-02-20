import { useState, useEffect } from 'react';

interface LogEntry {
  id: string;
  time: string;
  type: 'action' | 'status' | 'connection';
  message: string;
  status?: 'pending' | 'success' | 'error';
  details?: string;
}

export default function WorkLog() {
  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: '1',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      type: 'status',
      message: 'I am waiting for more...',
      status: 'pending'
    }
  ]);

  // Mock real-time process
  useEffect(() => {
    const timer = setTimeout(() => {
      setLogs(prev => [
        {
          id: Date.now().toString(),
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          type: 'action',
          message: 'Just sent me a message',
          details: 'Analyzing intent and checking tools...',
          status: 'success'
        },
        ...prev
      ]);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="w-80 h-full border-l border-white/10 flex flex-col">
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-sm">AI Work Log</h3>
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
        </div>
        <p className="text-[11px] text-white/50 leading-relaxed italic">
          My inner monologue as I stay awake, sensing signals and changes all around.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div className="text-[10px] uppercase tracking-wider text-white/30 font-bold mb-4">
          Today
        </div>
        
        {logs.map((log) => (
          <div key={log.id} className="work-log-item group">
            <div className={`work-log-dot ${log.status === 'pending' ? 'bg-amber-500' : 'bg-primary'}`}></div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-white/40 font-mono">{log.time}</span>
            </div>
            <div className="text-[13px] text-white/90 font-medium">
              {log.message}
            </div>
            {log.details && (
              <div className="text-[11px] text-white/40 mt-1 leading-relaxed">
                {log.details}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
