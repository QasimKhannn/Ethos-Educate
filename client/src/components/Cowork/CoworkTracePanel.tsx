// cowork — Trace tab: shows the agent's run steps (tool calls + outputs).
import { useState } from 'react';
import { Loader2, Check, ChevronRight, Code2, FileSearch, Globe, Wrench } from 'lucide-react';
import type { CoworkTraceEntry } from './useCoworkChat';

/** Friendly label + icon per tool name. */
function toolMeta(name: string): { label: string; Icon: typeof Wrench } {
  switch (name) {
    case 'execute_code':
      return { label: 'Running code', Icon: Code2 };
    case 'file_search':
      return { label: 'Searching files', Icon: FileSearch };
    case 'web_search':
    case 'tavily_search_results_json':
      return { label: 'Searching the web', Icon: Globe };
    default:
      return { label: name, Icon: Wrench };
  }
}

export function TraceRow({ entry }: { entry: CoworkTraceEntry }) {
  const [open, setOpen] = useState(false);
  const { label, Icon } = toolMeta(entry.name);
  const hasDetail = Boolean(entry.args || entry.output);

  return (
    <div className="rounded-md border border-border-medium">
      <button
        type="button"
        onClick={() => hasDetail && setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-2.5 py-2 text-left"
      >
        {hasDetail && (
          <ChevronRight
            className={`size-3.5 shrink-0 text-text-tertiary transition-transform ${
              open ? 'rotate-90' : ''
            }`}
          />
        )}
        <Icon className="size-4 shrink-0 text-text-info" />
        <span className="min-w-0 flex-1 truncate text-sm text-text-primary">{label}</span>
        {entry.status === 'running' ? (
          <Loader2 className="size-4 shrink-0 animate-spin text-text-secondary" />
        ) : (
          <Check className="size-4 shrink-0 text-green-500" />
        )}
      </button>
      {open && hasDetail && (
        <div className="space-y-2 border-t border-border-medium px-2.5 py-2">
          {entry.args && (
            <div>
              <div className="mb-1 text-[11px] uppercase tracking-wide text-text-tertiary">
                Input
              </div>
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded bg-surface-secondary p-2 text-xs text-text-secondary">
                {entry.args}
              </pre>
            </div>
          )}
          {entry.output && (
            <div>
              <div className="mb-1 text-[11px] uppercase tracking-wide text-text-tertiary">
                Output
              </div>
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded bg-surface-secondary p-2 text-xs text-text-secondary">
                {entry.output}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function CoworkTracePanel({ trace }: { trace: CoworkTraceEntry[] }) {
  if (trace.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 px-4 text-center text-text-tertiary">
        <p className="text-sm">No steps yet</p>
        <p className="text-xs">Tool calls the agent makes will appear here as it works.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-2 overflow-y-auto p-3">
      {trace.map((entry) => (
        <TraceRow key={entry.id} entry={entry} />
      ))}
    </div>
  );
}
