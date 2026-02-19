import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';

export default function Files() {
  const [files, setFiles] = useState<any[]>([]);
  const [dragging, setDragging] = useState(false);

  useEffect(() => { loadFiles(); }, []);

  const loadFiles = async () => {
    try { setFiles(await api.getFiles()); } catch (e) { console.error(e); }
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const items = Array.from(e.dataTransfer.files);
    for (const file of items) {
      await api.uploadFile(file);
    }
    await loadFiles();
  }, []);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="h-14 px-6 flex items-center border-b border-border bg-bg-card/50">
        <h2 className="font-semibold">Files</h2>
        <span className="ml-auto text-sm text-fg-muted">{files.length} file(s)</span>
      </div>

      <div
        className={`flex-1 overflow-y-auto px-6 py-4 ${dragging ? 'bg-accent/10 border-2 border-dashed border-accent' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        {files.length === 0 && (
          <div className="text-center mt-16">
            <p className="text-4xl mb-4">📁</p>
            <p className="text-fg-muted">Drop files here or use the chat to upload</p>
          </div>
        )}
        <div className="grid gap-3">
          {files.map((file: any) => (
            <div key={file.id} className="bg-bg-card border border-border rounded-xl p-4 flex items-center gap-3">
              <span className="text-2xl">📄</span>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{file.filename}</p>
                <p className="text-xs text-fg-muted">{file.mimeType} · {formatSize(file.sizeBytes)}</p>
              </div>
              <span className="text-xs text-fg-muted">{new Date(file.createdAt).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
