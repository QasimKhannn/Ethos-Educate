// cowork — workspace panel header: usage, file upload, folder upload, refresh.
import { useRef, type ChangeEvent } from 'react';
import { Upload, FolderUp, RefreshCw, Loader2, History, Archive } from 'lucide-react';

export type CoworkUploadItem = { file: File; relativePath?: string };

type Props = {
  usage?: number;
  quotaBytes?: number;
  isFetching: boolean;
  isUploading: boolean;
  /** Cumulative files sent vs. total for the active (chunked) upload, if any. */
  uploadProgress?: { sent: number; total: number } | null;
  isDownloading?: boolean;
  onUpload: (items: CoworkUploadItem[]) => void;
  onRefresh: () => void;
  onOpenHistory: () => void;
  onDownloadZip: () => void;
};

const formatBytes = (bytes?: number): string => {
  if (bytes == null) {
    return '0 B';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(1)} ${units[i]}`;
};

// Folders commonly carry junk (dependencies, VCS, build output) — skip it so
// workspaces stay clean and uploads stay small.
const IGNORE_DIRS = new Set([
  'node_modules', '.git', '.svn', '.hg', '.idea', '.vscode', 'dist', 'build', 'out',
  '.next', '.nuxt', '.cache', '.turbo', 'coverage', '__pycache__', '.venv', 'venv',
  '.pytest_cache', '.parcel-cache', '.gradle', 'target',
]);
const IGNORE_FILES = new Set(['.DS_Store', 'Thumbs.db', '.env']);

const isIgnored = (relPath: string): boolean => {
  const parts = relPath.split('/');
  if (parts.some((seg) => IGNORE_DIRS.has(seg))) {
    return true;
  }
  return IGNORE_FILES.has(parts[parts.length - 1]);
};

const toItems = (fileList: FileList | null, filterJunk: boolean): CoworkUploadItem[] => {
  if (!fileList) {
    return [];
  }
  const items = Array.from(fileList).map((file) => ({
    file,
    // webkitRelativePath is set for folder (webkitdirectory) selections.
    relativePath: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
  }));
  return filterJunk ? items.filter((it) => !isIgnored(it.relativePath ?? '')) : items;
};

export default function CoworkWorkspaceHeader({
  usage,
  quotaBytes,
  isFetching,
  isUploading,
  uploadProgress,
  isDownloading,
  onUpload,
  onRefresh,
  onOpenHistory,
  onDownloadZip,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);

  const usageLabel = quotaBytes
    ? `${formatBytes(usage)} / ${formatBytes(quotaBytes)}`
    : formatBytes(usage);

  const handleChange = (filterJunk: boolean) => (e: ChangeEvent<HTMLInputElement>) => {
    const items = toItems(e.target.files, filterJunk);
    if (items.length) {
      onUpload(items);
    }
    e.target.value = '';
  };

  return (
    <div className="flex-none border-b border-border-medium px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">Files</p>
          {isUploading ? (
            <span className="flex items-center gap-1 text-xs text-text-secondary">
              <Loader2 className="size-3 animate-spin" />
              {uploadProgress && uploadProgress.total > 1
                ? `Uploading ${uploadProgress.sent.toLocaleString()} / ${uploadProgress.total.toLocaleString()}…`
                : 'Uploading…'}
            </span>
          ) : (
            <span className="text-xs text-text-secondary">{usageLabel} used</span>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            title="History (undo applied changes)"
            className="rounded-md p-1.5 text-text-tertiary hover:bg-surface-secondary hover:text-text-primary"
            onClick={onOpenHistory}
          >
            <History className="size-3.5" />
          </button>
          <button
            type="button"
            title="Download workspace as .zip"
            disabled={isDownloading}
            className="rounded-md p-1.5 text-text-tertiary hover:bg-surface-secondary hover:text-text-primary disabled:opacity-50"
            onClick={onDownloadZip}
          >
            {isDownloading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Archive className="size-3.5" />
            )}
          </button>
          <button
            type="button"
            title="Refresh"
            className="rounded-md p-1.5 text-text-tertiary hover:bg-surface-secondary hover:text-text-primary"
            onClick={onRefresh}
          >
            <RefreshCw className={`size-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            title="Upload files"
            disabled={isUploading}
            className="rounded-md p-1.5 text-text-tertiary hover:bg-surface-secondary hover:text-text-primary disabled:opacity-50"
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="size-3.5" />
          </button>
          <button
            type="button"
            title="Upload a folder"
            disabled={isUploading}
            className="rounded-md p-1.5 text-text-tertiary hover:bg-surface-secondary hover:text-text-primary disabled:opacity-50"
            onClick={() => folderRef.current?.click()}
          >
            <FolderUp className="size-3.5" />
          </button>
          <input ref={fileRef} type="file" multiple className="hidden" onChange={handleChange(false)} />
          <input
            ref={folderRef}
            type="file"
            className="hidden"
            onChange={handleChange(true)}
            {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
          />
        </div>
      </div>
    </div>
  );
}
