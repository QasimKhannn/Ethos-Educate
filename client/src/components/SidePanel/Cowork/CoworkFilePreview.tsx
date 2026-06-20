// cowork — full-panel file preview overlay (text/image inline; binary as styled card).
import { useEffect, useState } from 'react';
import { X, Download, FileText, FileSpreadsheet, Presentation, File } from 'lucide-react';
import { dataService } from 'librechat-data-provider';
import type { TCoworkFileNode } from 'librechat-data-provider';

type Props = {
  projectId: string;
  node: TCoworkFileNode;
  onClose: () => void;
  onDownload: (node: TCoworkFileNode) => void;
};

const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'];
const TEXT_EXT = ['txt', 'md', 'csv', 'json', 'js', 'ts', 'py', 'html', 'css', 'log', 'yaml', 'yml'];

const getExt = (name: string) => name.split('.').pop()?.toLowerCase() ?? '';

const formatBytes = (bytes?: number): string => {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) { value /= 1024; i++; }
  return `${value.toFixed(1)} ${units[i]}`;
};

type FileTypeMeta = {
  label: string;
  bg: string;
  text: string;
  Icon: typeof File;
};

function getFileMeta(ext: string): FileTypeMeta {
  switch (ext) {
    case 'pdf':
      return { label: 'PDF', bg: 'bg-red-500/10', text: 'text-red-500', Icon: FileText };
    case 'docx':
    case 'doc':
      return { label: 'Word', bg: 'bg-blue-500/10', text: 'text-blue-500', Icon: FileText };
    case 'xlsx':
    case 'xls':
      return { label: 'Excel', bg: 'bg-green-500/10', text: 'text-green-600', Icon: FileSpreadsheet };
    case 'pptx':
    case 'ppt':
      return { label: 'PowerPoint', bg: 'bg-orange-500/10', text: 'text-orange-500', Icon: Presentation };
    case 'zip':
    case 'tar':
    case 'gz':
      return { label: 'Archive', bg: 'bg-yellow-500/10', text: 'text-yellow-600', Icon: File };
    default:
      return { label: ext.toUpperCase() || 'File', bg: 'bg-surface-tertiary', text: 'text-text-secondary', Icon: File };
  }
}

export default function CoworkFilePreview({ projectId, node, onClose, onDownload }: Props) {
  const [text, setText] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileExt = getExt(node.name);
  const isImage = IMAGE_EXT.includes(fileExt);
  const isText = TEXT_EXT.includes(fileExt);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    setText(null);
    setImageUrl(null);
    setError(null);

    if (!isImage && !isText) return;

    setLoading(true);
    dataService
      .getCoworkFileBlob(projectId, node.path)
      .then(async (blob) => {
        if (cancelled) return;
        if (isImage) {
          objectUrl = URL.createObjectURL(blob);
          setImageUrl(objectUrl);
        } else {
          const content = await blob.text();
          if (!cancelled) setText(content.slice(0, 20000));
        }
      })
      .catch(() => !cancelled && setError('Could not load preview.'))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [projectId, node.path, isImage, isText]);

  const meta = getFileMeta(fileExt);

  return (
    // Absolute overlay that covers the whole panel (panel must be `relative`)
    <div className="absolute inset-0 z-10 flex flex-col bg-surface-primary">
      {/* Header */}
      <div className="flex flex-none items-center justify-between gap-2 border-b border-border-medium px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <meta.Icon className={`size-4 flex-none ${meta.text}`} />
          <span className="truncate text-sm font-medium text-text-primary">{node.name}</span>
          {node.size != null && (
            <span className="flex-none text-xs text-text-tertiary">{formatBytes(node.size)}</span>
          )}
        </div>
        <div className="flex flex-none items-center gap-1">
          <button
            type="button"
            title="Download"
            onClick={() => onDownload(node)}
            className="rounded-md p-1.5 text-text-secondary hover:bg-surface-secondary hover:text-text-primary"
          >
            <Download className="size-4" />
          </button>
          <button
            type="button"
            title="Close preview"
            onClick={onClose}
            className="rounded-md p-1.5 text-text-secondary hover:bg-surface-secondary hover:text-text-primary"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto">
        {loading && (
          <div className="flex h-full items-center justify-center text-sm text-text-secondary">
            Loading…
          </div>
        )}
        {error && (
          <div className="flex h-full items-center justify-center text-sm text-red-500">{error}</div>
        )}

        {/* Image */}
        {!loading && !error && imageUrl && (
          <div className="flex h-full items-center justify-center p-4">
            <img src={imageUrl} alt={node.name} className="max-h-full max-w-full rounded-lg object-contain shadow-sm" />
          </div>
        )}

        {/* Text / code */}
        {!loading && !error && text != null && (
          <pre className="h-full overflow-auto whitespace-pre-wrap break-words p-3 text-xs leading-relaxed text-text-primary">
            {text}
          </pre>
        )}

        {/* Binary file card */}
        {!loading && !error && !isImage && !isText && (
          <div className="flex h-full flex-col items-center justify-center gap-5 p-6">
            <div className={`flex size-20 items-center justify-center rounded-2xl ${meta.bg}`}>
              <meta.Icon className={`size-10 ${meta.text}`} />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-text-primary">{node.name}</p>
              {node.size != null && (
                <p className="mt-0.5 text-xs text-text-tertiary">{formatBytes(node.size)}</p>
              )}
              <span className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium ${meta.bg} ${meta.text}`}>
                {meta.label} document
              </span>
            </div>
            <button
              type="button"
              onClick={() => onDownload(node)}
              className="flex items-center gap-2 rounded-lg border border-border-medium px-4 py-2 text-sm text-text-primary hover:bg-surface-secondary"
            >
              <Download className="size-4" />
              Download to open
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
