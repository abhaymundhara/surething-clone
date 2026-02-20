import { useEffect, useState } from 'react';
import { useStore } from '../lib/store';
import { api } from '../lib/api';
import { Upload, FileText, Image, File, Loader2, Trash2, Search } from 'lucide-react';

interface FileItem {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  createdAt: string;
  analysisResult?: any;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return Image;
  if (mimeType.startsWith('text/') || mimeType.includes('json')) return FileText;
  return File;
}

export default function Files() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const { currentCellId, addToast } = useStore();

  const loadFiles = () => {
    api.getFiles(currentCellId ?? undefined)
      .then(f => { setFiles(f); setLoading(false); })
      .catch(() => { addToast('Failed to load files', 'error'); setLoading(false); });
  };

  useEffect(() => { loadFiles(); }, [currentCellId]);

  const handleUpload = async (fileList: FileList | null) => {
    if (!fileList) return;
    setUploading(true);
    const results = { success: 0, failed: 0 };

    for (const file of Array.from(fileList)) {
      try {
        await api.uploadFile(file, currentCellId ?? undefined);
        results.success++;
      } catch {
        results.failed++;
      }
    }

    setUploading(false);
    if (results.success > 0) addToast(`Uploaded ${results.success} file(s)`, 'success');
    if (results.failed > 0) addToast(`${results.failed} upload(s) failed`, 'error');
    loadFiles();
  };

  const handleAnalyze = async (fileId: string) => {
    setAnalyzing(fileId);
    try {
      const result = await api.analyzeFile(fileId);
      addToast('Analysis complete', 'success');
      loadFiles(); // Refresh to show analysis
    } catch {
      addToast('Analysis failed', 'error');
    } finally {
      setAnalyzing(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleUpload(e.dataTransfer.files);
  };

  return (
    <div className="h-full flex flex-col">
      <header className="flex items-center justify-between px-4 h-14 border-b border-border bg-bg-card shrink-0">
        <h2 className="text-sm font-medium text-fg">Files</h2>
        <label className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-accent hover:bg-accent-hover text-white rounded-lg cursor-pointer transition-colors">
          <Upload className="w-3.5 h-3.5" />
          Upload
          <input type="file" multiple className="hidden" onChange={e => handleUpload(e.target.files)} />
        </label>
      </header>

      <div
        className="flex-1 overflow-y-auto"
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
      >
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-5 h-5 text-fg-muted animate-spin" />
          </div>
        ) : files.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-fg-dim">
            <Upload className="w-10 h-10 mb-3 opacity-40" />
            <p className="text-sm">No files yet</p>
            <p className="text-xs mt-1">Upload files or drag and drop them here</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {files.map(file => {
              const Icon = getFileIcon(file.mimeType);
              return (
                <div key={file.id} className="flex items-center gap-3 px-4 py-3 hover:bg-bg-hover/50 transition-colors group">
                  <Icon className="w-5 h-5 text-fg-muted shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-fg truncate">{file.filename}</p>
                    <p className="text-[11px] text-fg-dim">
                      {formatSize(file.size)} · {file.mimeType} · {new Date(file.createdAt).toLocaleDateString()}
                    </p>
                    {file.analysisResult && (
                      <p className="text-xs text-fg-muted mt-1 line-clamp-2">
                        {file.analysisResult.analysis}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleAnalyze(file.id)}
                    disabled={analyzing === file.id}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-fg-muted hover:text-accent transition-all"
                    title="Analyze with AI"
                  >
                    {analyzing === file.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
