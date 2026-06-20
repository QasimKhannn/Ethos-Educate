// cowork — full-panel diff overlay for one staged change (Apply / Discard / Close).
// Text changes render a line-level diff; binary changes show a metadata card.
import { useMemo } from 'react';
import { diffLines } from 'diff';
import { X, Check, Trash2, Loader2, FileText } from 'lucide-react';
import type { TCoworkChange } from 'librechat-data-provider';
import { useCoworkChangeDiffQuery } from '~/data-provider';

type Props = {
  projectId: string;
  change: TCoworkChange;
  isApplying?: boolean;
  isDiscarding?: boolean;
  onApply: () => void;
  onDiscard: () => void;
  onClose: () => void;
};

const formatBytes = (bytes?: number): string => {
  if (bytes == null) {
    return '';
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

type DiffRow = { type: 'add' | 'del' | 'ctx'; text: string };
const MAX_ROWS = 2000;

/** Flatten a line diff into typed rows for rendering, capped for very large diffs. */
function buildRows(live: string, proposed: string): { rows: DiffRow[]; truncated: boolean } {
  const parts = diffLines(live, proposed);
  const rows: DiffRow[] = [];
  for (const part of parts) {
    const type: DiffRow['type'] = part.added ? 'add' : part.removed ? 'del' : 'ctx';
    const lines = part.value.split('\n');
    if (lines.length > 0 && lines[lines.length - 1] === '') {
      lines.pop();
    }
    for (const text of lines) {
      rows.push({ type, text });
      if (rows.length >= MAX_ROWS) {
        return { rows, truncated: true };
      }
    }
  }
  return { rows, truncated: false };
}

const ROW_STYLE: Record<DiffRow['type'], string> = {
  add: 'bg-green-500/10 text-green-600 dark:text-green-400',
  del: 'bg-red-500/10 text-red-500 dark:text-red-400',
  ctx: 'text-text-secondary',
};
const ROW_PREFIX: Record<DiffRow['type'], string> = { add: '+', del: '-', ctx: ' ' };

export default function CoworkDiffView({
  projectId,
  change,
  isApplying,
  isDiscarding,
  onApply,
  onDiscard,
  onClose,
}: Props) {
  const { data, isLoading, isError } = useCoworkChangeDiffQuery(projectId, change.path);

  const diff = useMemo(() => {
    if (!data || data.kind !== 'text') {
      return null;
    }
    return buildRows(data.live ?? '', data.proposed ?? '');
  }, [data]);

  const busy = isApplying || isDiscarding;

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-surface-primary">
      {/* Header */}
      <div className="flex flex-none items-center justify-between gap-2 border-b border-border-medium px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <FileText className="size-4 flex-none text-text-info" />
          <span className="truncate text-sm font-medium text-text-primary">{change.path}</span>
          <span
            className={`flex-none rounded-full px-2 py-0.5 text-[10px] font-medium ${
              change.status === 'created'
                ? 'bg-green-500/10 text-green-600'
                : 'bg-amber-500/10 text-amber-600'
            }`}
          >
            {change.status === 'created' ? 'new' : 'edited'}
          </span>
        </div>
        <div className="flex flex-none items-center gap-1">
          <button
            type="button"
            title="Apply this change"
            disabled={busy}
            onClick={onApply}
            className="flex items-center gap-1 rounded-md bg-text-info px-2.5 py-1.5 text-xs text-white hover:opacity-90 disabled:opacity-50"
          >
            {isApplying ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
            Apply
          </button>
          <button
            type="button"
            title="Discard this change"
            disabled={busy}
            onClick={onDiscard}
            className="rounded-md p-1.5 text-text-secondary hover:bg-surface-secondary hover:text-red-500 disabled:opacity-50"
          >
            {isDiscarding ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
          </button>
          <button
            type="button"
            title="Close"
            onClick={onClose}
            className="rounded-md p-1.5 text-text-secondary hover:bg-surface-secondary hover:text-text-primary"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto">
        {isLoading && (
          <div className="flex h-full items-center justify-center text-sm text-text-secondary">
            <Loader2 className="mr-2 size-4 animate-spin" /> Loading diff…
          </div>
        )}
        {isError && (
          <div className="flex h-full items-center justify-center text-sm text-red-500">
            Could not load the diff.
          </div>
        )}

        {/* Text diff */}
        {!isLoading && !isError && diff && (
          <div className="min-h-full font-mono text-xs leading-relaxed">
            {diff.rows.map((row, i) => (
              <div key={i} className={`flex whitespace-pre-wrap break-words px-3 ${ROW_STYLE[row.type]}`}>
                <span className="mr-2 select-none opacity-60">{ROW_PREFIX[row.type]}</span>
                <span className="flex-1">{row.text || ' '}</span>
              </div>
            ))}
            {diff.truncated && (
              <p className="px-3 py-2 text-xs italic text-text-tertiary">
                Diff truncated — apply and download the file to see the full result.
              </p>
            )}
          </div>
        )}

        {/* Binary change — no line diff */}
        {!isLoading && !isError && data && data.kind === 'binary' && (
          <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-surface-tertiary">
              <FileText className="size-8 text-text-secondary" />
            </div>
            <div>
              <p className="text-sm font-medium text-text-primary">{change.path}</p>
              <p className="mt-1 text-xs text-text-tertiary">
                {change.status === 'created'
                  ? `New file · ${formatBytes(change.proposedSize)}`
                  : `${formatBytes(change.liveSize)} → ${formatBytes(change.proposedSize)}`}
              </p>
              <p className="mt-2 text-xs text-text-secondary">
                Binary file — no line preview. Apply, then open it from the workspace.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
