// cowork — "Memory" tab: edit the project's core memory (always injected, budget-capped)
// and read the on-demand archive. The agent also appends to these during runs.
import { useEffect, useState } from 'react';
import { Save, Loader2, BrainCircuit, ChevronDown, ChevronRight } from 'lucide-react';
import { useToastContext } from '@librechat/client';
import {
  useCoworkMemoryQuery,
  useCoworkMemoryArchiveQuery,
  useUpdateCoworkMemoryMutation,
} from '~/data-provider';

export default function CoworkMemoryPanel({ projectId }: { projectId: string }) {
  const { showToast } = useToastContext();
  const { data, isLoading } = useCoworkMemoryQuery(projectId);
  const updateMutation = useUpdateCoworkMemoryMutation(projectId);

  const [text, setText] = useState('');
  const [dirty, setDirty] = useState(false);
  const [showArchive, setShowArchive] = useState(false);

  const serverMemory = data?.memory ?? '';
  // Seed the editor from the server value whenever it changes and the user hasn't edited
  // (so agent-appended memory shows up without clobbering an in-progress manual edit).
  useEffect(() => {
    if (!dirty) {
      setText(serverMemory);
    }
  }, [serverMemory, dirty]);

  const { data: archiveData, isLoading: archiveLoading } = useCoworkMemoryArchiveQuery(projectId, {
    enabled: showArchive,
  });

  const save = () => {
    updateMutation.mutate(text, {
      onSuccess: (res) => {
        setDirty(false);
        showToast({
          message: res?.overBudget
            ? 'Saved — note: memory is over budget and will be trimmed when the agent reads it.'
            : 'Memory saved.',
          status: 'success',
        });
      },
      onError: () => showToast({ message: 'Could not save memory.', status: 'error' }),
    });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-none border-b border-border-medium px-4 py-3">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
          <BrainCircuit className="size-3.5" /> Project memory
        </p>
        <p className="mt-1 text-xs text-text-tertiary">
          Durable facts the agent sees every time. You can edit these; the agent also adds to them.
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </div>
        ) : (
          <>
            <textarea
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setDirty(true);
              }}
              placeholder="e.g. - Audience is school administrators. - Always use British spelling. - Deliverables go in output/ as .docx."
              className="min-h-[180px] flex-1 resize-none rounded-lg border border-border-medium bg-surface-primary p-3 font-mono text-xs leading-relaxed text-text-primary outline-none focus:outline-none focus:ring-0"
            />
            <div className="flex flex-none items-center justify-between">
              <span className="text-[11px] text-text-tertiary">{text.length} chars</span>
              <button
                type="button"
                onClick={save}
                disabled={!dirty || updateMutation.isLoading}
                className="flex items-center gap-1.5 rounded-md bg-text-info px-3 py-1.5 text-xs text-white hover:opacity-90 disabled:opacity-40"
              >
                {updateMutation.isLoading ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Save className="size-3.5" />
                )}
                Save
              </button>
            </div>

            <div className="flex-none border-t border-border-medium pt-2">
              <button
                type="button"
                onClick={() => setShowArchive((v) => !v)}
                className="flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary"
              >
                {showArchive ? (
                  <ChevronDown className="size-3.5" />
                ) : (
                  <ChevronRight className="size-3.5" />
                )}
                Archive (read-only — the agent reads this on demand)
              </button>
              {showArchive && (
                <div className="mt-2">
                  {archiveLoading ? (
                    <div className="flex items-center gap-2 text-xs text-text-tertiary">
                      <Loader2 className="size-3.5 animate-spin" /> Loading…
                    </div>
                  ) : (archiveData?.archive ?? '').trim() ? (
                    <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-surface-secondary p-3 text-xs text-text-secondary">
                      {archiveData?.archive}
                    </pre>
                  ) : (
                    <p className="text-xs text-text-tertiary">Archive is empty.</p>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
