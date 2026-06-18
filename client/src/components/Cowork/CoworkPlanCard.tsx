// cowork — renders a Plan-mode reply as a distinct, bordered "Plan" card with a one-click
// "Approve & run in Agent" handoff. Read-only: the plan was produced without touching files.
import { ClipboardList, Play, Loader2 } from 'lucide-react';
import MarkdownLite from '~/components/Chat/Messages/Content/MarkdownLite';

export default function CoworkPlanCard({
  content,
  isStreaming,
  onApprove,
}: {
  content: string;
  isStreaming?: boolean;
  onApprove: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border-medium bg-surface-primary shadow-sm">
      <div className="flex items-center gap-2 border-b border-border-medium bg-surface-secondary/50 px-3 py-2">
        <ClipboardList className="size-4 text-text-info" />
        <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
          Plan
        </span>
        <span className="ml-auto text-[11px] text-text-tertiary">read-only · nothing changed yet</span>
      </div>

      <div className="prose prose-sm dark:prose-invert max-w-none px-4 py-3">
        <MarkdownLite content={content} />
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-border-medium px-3 py-2">
        {isStreaming ? (
          <span className="flex items-center gap-1.5 text-xs text-text-tertiary">
            <Loader2 className="size-3.5 animate-spin" /> Drafting plan…
          </span>
        ) : (
          <button
            type="button"
            onClick={onApprove}
            className="flex items-center gap-1.5 rounded-md bg-text-info px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
            title="Switch to Agent mode and execute this plan"
          >
            <Play className="size-3.5 fill-current" />
            Approve &amp; run in Agent
          </button>
        )}
      </div>
    </div>
  );
}
