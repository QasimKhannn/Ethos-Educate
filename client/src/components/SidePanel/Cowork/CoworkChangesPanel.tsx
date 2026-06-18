// cowork — "Pending changes" section: staged edits with Apply / Apply all / Discard,
// and a full-panel diff overlay. Self-hides when there are no staged changes.
import { useState } from 'react';
import { Check, Trash2, FileDiff, Loader2 } from 'lucide-react';
import { useToastContext } from '@librechat/client';
import type { TCoworkChange } from 'librechat-data-provider';
import {
  useCoworkChangesQuery,
  useApplyCoworkChangesMutation,
  useDiscardCoworkChangeMutation,
} from '~/data-provider';
import CoworkDiffView from './CoworkDiffView';

export default function CoworkChangesPanel({ projectId }: { projectId: string }) {
  const { showToast } = useToastContext();
  const { data: changes = [] } = useCoworkChangesQuery(projectId);
  const applyMutation = useApplyCoworkChangesMutation(projectId);
  const discardMutation = useDiscardCoworkChangeMutation(projectId);

  const [selected, setSelected] = useState<TCoworkChange | null>(null);
  const [busyPath, setBusyPath] = useState<string | null>(null);

  if (changes.length === 0) {
    return null;
  }

  const apply = (paths?: string[]) => {
    setBusyPath(paths?.[0] ?? '*');
    applyMutation.mutate(
      { paths },
      {
        onSuccess: () => {
          setSelected(null);
          showToast({ message: paths ? 'Change applied.' : 'All changes applied.', status: 'success' });
        },
        onError: () => showToast({ message: 'Could not apply changes.', status: 'error' }),
        onSettled: () => setBusyPath(null),
      },
    );
  };

  const discard = (filePath?: string) => {
    setBusyPath(filePath ?? '*');
    discardMutation.mutate(filePath, {
      onSuccess: () => setSelected(null),
      onError: () => showToast({ message: 'Could not discard change.', status: 'error' }),
      onSettled: () => setBusyPath(null),
    });
  };

  const busy = applyMutation.isLoading || discardMutation.isLoading;

  return (
    <>
      <div className="flex-none border-b border-border-medium bg-surface-secondary/40 px-3 py-2.5">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-text-secondary">
            <FileDiff className="size-3.5" /> Pending changes ({changes.length})
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={busy}
              onClick={() => apply()}
              className="rounded-md bg-text-info px-2 py-1 text-[11px] font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              Apply all
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => discard()}
              className="rounded-md px-2 py-1 text-[11px] text-text-secondary hover:bg-surface-tertiary hover:text-red-500 disabled:opacity-50"
            >
              Discard all
            </button>
          </div>
        </div>

        <ul className="flex flex-col gap-0.5">
          {changes.map((c) => {
            const rowBusy = busy && (busyPath === c.path || busyPath === '*');
            return (
              <li
                key={c.path}
                className="group flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-surface-tertiary"
              >
                <button
                  type="button"
                  onClick={() => setSelected(c)}
                  className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                  title="View diff"
                >
                  <span
                    className={`size-1.5 flex-none rounded-full ${
                      c.status === 'created' ? 'bg-green-500' : 'bg-amber-500'
                    }`}
                  />
                  <span className="truncate text-xs text-text-primary">{c.path}</span>
                </button>
                {rowBusy ? (
                  <Loader2 className="size-3.5 flex-none animate-spin text-text-tertiary" />
                ) : (
                  <>
                    <button
                      type="button"
                      title="Apply"
                      disabled={busy}
                      onClick={() => apply([c.path])}
                      className="flex-none rounded p-1 text-text-tertiary opacity-0 hover:text-text-info group-hover:opacity-100 disabled:opacity-50"
                    >
                      <Check className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Discard"
                      disabled={busy}
                      onClick={() => discard(c.path)}
                      className="flex-none rounded p-1 text-text-tertiary opacity-0 hover:text-red-500 group-hover:opacity-100 disabled:opacity-50"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {selected && (
        <CoworkDiffView
          projectId={projectId}
          change={selected}
          isApplying={applyMutation.isLoading && busyPath === selected.path}
          isDiscarding={discardMutation.isLoading && busyPath === selected.path}
          onApply={() => apply([selected.path])}
          onDiscard={() => discard(selected.path)}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
