// cowork — lightweight inline preview of a selected workspace file.
import { useEffect, useState } from 'react';
import { X, Download } from 'lucide-react';
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

const ext = (name: string) => name.split('.').pop()?.toLowerCase() ?? '';

export default function CoworkFilePreview({ projectId, node, onClose, onDownload }: Props) {
  const [text, setText] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileExt = ext(node.name);
  const isImage = IMAGE_EXT.includes(fileExt);
  const isText = TEXT_EXT.includes(fileExt);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    setText(null);
    setImageUrl(null);
    setError(null);

    if (!isImage && !isText) {
      return;
    }

    setLoading(true);
    dataService
      .getCoworkFileBlob(projectId, node.path)
      .then(async (blob) => {
        if (cancelled) {
          return;
        }
        if (isImage) {
          objectUrl = URL.createObjectURL(blob);
          setImageUrl(objectUrl);
        } else {
          const content = await blob.text();
          if (!cancelled) {
            setText(content.slice(0, 20000));
          }
        }
      })
      .catch(() => !cancelled && setError('Could not load preview.'))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [projectId, node.path, isImage, isText]);

  return (
    <div className="flex max-h-64 flex-col border-t border-border-medium">
      <div className="flex items-center justify-between gap-2 px-2 py-1.5">
        <span className="truncate text-xs font-medium text-text-primary">{node.name}</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            title="Download"
            className="rounded p-1 text-text-secondary hover:text-text-primary"
            onClick={() => onDownload(node)}
          >
            <Download className="size-3.5" />
          </button>
          <button
            type="button"
            title="Close preview"
            className="rounded p-1 text-text-secondary hover:text-text-primary"
            onClick={onClose}
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>
      <div className="overflow-auto px-2 pb-2">
        {loading && <p className="text-xs text-text-secondary">Loading…</p>}
        {error && <p className="text-xs text-red-500">{error}</p>}
        {!loading && !error && imageUrl && (
          <img src={imageUrl} alt={node.name} className="max-h-48 rounded object-contain" />
        )}
        {!loading && !error && text != null && (
          <pre className="whitespace-pre-wrap break-words text-xs text-text-primary">{text}</pre>
        )}
        {!loading && !error && !isImage && !isText && (
          <p className="text-xs text-text-secondary">No inline preview — use download.</p>
        )}
      </div>
    </div>
  );
}
