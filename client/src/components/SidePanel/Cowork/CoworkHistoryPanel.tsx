// cowork — full-panel "History" overlay: undo checkpoints with Restore.
// Each Apply records a checkpoint; Restore reverts the affected files (and is itself
// snapshotted, so it can be redone).
import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { X, RotateCcw, Loader2, History } from 'lucide-react';
import { useToastContext } from '@librechat/client';
import { useCoworkCheckpointsQuery, useRestoreCoworkCheckpointMutation } from '~/data-provider';

const timeAgo = (iso: string): string => {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return '';
  }
};

export default function CoworkHistoryPanel({
  projectId,
  onClose,
}: {
  projectId: string;
  onClose: () => void;
}) {
  const { showToast } = useToastContext();
  const { data: checkpoints = [], isLoading } = useCoworkCheckpointsQuery(projectId);
  const restoreMutation = useRestoreCoworkCheckpointMutation(projectId);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const restore = (id: string) => {
    setRestoringId(id);
    restoreMutation.mutate(id, {
      onSuccess: () => showToast({ message: 'Reverted to this point.', status: 'success' }),
      onError: () => showToast({ message: 'Could not restore.', status: 'error' }),
      onSettled: () => setRestoringId(null),
    });
  };

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-surface-primary">
      {/* Header */}
      <div className="flex flex-none items-center justify-between gap-2 border-b border-border-medium px-3 py-2.5">
        <span className="flex items-center gap-1.5 text-sm font-medium text-text-primary">
          <History className="size-4 text-text-info" /> History
        </span>
        <button
          type="button"
          title="Close"
          onClick={onClose}
          className="rounded-md p-1.5 text-text-secondary hover:bg-surface-secondary hover:text-text-primary"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto p-2">
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-sm text-text-secondary">
            <Loader2 className="mr-2 size-4 animate-spin" /> Loading…
          </div>
        ) : checkpoints.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-text-secondary">
            <History className="size-7 text-text-tertiary" />
            <p className="text-sm">No history yet.</p>
            <p className="text-xs text-text-tertiary">
              Applied changes show up here so you can undo them.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {checkpoints.map((cp) => {
              const busy = restoringId === cp.id;
              const count = cp.entries?.length ?? 0;
              return (
                <li
                  key={cp.id}
                  className="flex items-start gap-2 rounded-lg border border-border-medium px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-text-primary">
                      {cp.message || `Applied ${count} change${count === 1 ? '' : 's'}`}
                    </p>
                    <p className="mt-0.5 text-[11px] text-text-tertiary">
                      {timeAgo(cp.createdAt)} · {count} file{count === 1 ? '' : 's'}
                    </p>
                  </div>
                  <button
                    type="button"
                    title="Revert to this point"
                    disabled={restoreMutation.isLoading}
                    onClick={() => restore(cp.id)}
                    className="flex flex-none items-center gap-1 rounded-md border border-border-medium px-2 py-1 text-[11px] text-text-secondary hover:bg-surface-secondary hover:text-text-primary disabled:opacity-50"
                  >
                    {busy ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <RotateCcw className="size-3.5" />
                    )}
                    Restore
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
