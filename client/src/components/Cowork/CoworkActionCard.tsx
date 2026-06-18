// cowork — Phase 8: write-action approval card. The agent previews a connector write/publish/send
// as a fenced ```action block; this renders it with an "Approve & run" button. Approving sends a
// confirmation message so the agent then performs the action. Mirrors the email draft card.
import { ShieldCheck, Check, Loader2 } from 'lucide-react';

export type ParsedAction = {
  connector?: string;
  action?: string;
  target?: string;
  details: string;
};

/**
 * Pull the first ```action fenced block out of an assistant message.
 * Headers (connector/action/target) come first, then a blank line, then the details body.
 * Returns the parsed action (or null) and the message text with the block removed.
 */
export function extractAction(text: string): { action: ParsedAction | null; rest: string } {
  const match = text.match(/```action[ \t]*\r?\n([\s\S]*?)```/i);
  if (!match) {
    return { action: null, rest: text };
  }
  const lines = match[1].split('\n');
  const action: ParsedAction = { details: '' };
  let i = 0;
  for (; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '') {
      i++;
      break; // blank line ends the headers
    }
    const header = line.match(/^(connector|action|target)[ \t]*:[ \t]*(.*)$/i);
    if (!header) {
      break; // first non-header line starts the details
    }
    const key = header[1].toLowerCase() as 'connector' | 'action' | 'target';
    action[key] = header[2].trim();
  }
  action.details = lines.slice(i).join('\n').trim();

  const start = match.index ?? 0;
  const rest = (text.slice(0, start) + text.slice(start + match[0].length)).trim();
  return { action, rest };
}

function Row({ label, value }: { label: string; value?: string }) {
  if (!value) {
    return null;
  }
  return (
    <div className="flex gap-2 text-xs">
      <span className="w-16 flex-none text-text-tertiary">{label}</span>
      <span className="min-w-0 flex-1 break-words text-text-primary">{value}</span>
    </div>
  );
}

export default function CoworkActionCard({
  action,
  onApprove,
  isBusy,
}: {
  action: ParsedAction;
  /** When provided, shows an active "Approve & run" button (only on the latest, pending action). */
  onApprove?: () => void;
  isBusy?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-amber-500/40 bg-surface-primary shadow-sm">
      <div className="flex items-center gap-2 border-b border-border-medium bg-amber-500/10 px-3 py-2">
        <ShieldCheck className="size-4 text-amber-600" />
        <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
          Action needs approval
        </span>
        <span className="ml-auto text-[11px] text-text-tertiary">nothing happens until you approve</span>
      </div>

      <div className="flex flex-col gap-1.5 px-4 py-3">
        <Row label="Tool" value={action.connector} />
        <Row label="Action" value={action.action} />
        <Row label="Target" value={action.target} />
        {action.details && (
          <div className="mt-1 whitespace-pre-wrap break-words border-t border-border-medium pt-2 text-sm text-text-primary">
            {action.details}
          </div>
        )}
      </div>

      {onApprove && (
        <div className="flex items-center justify-end gap-2 border-t border-border-medium px-3 py-2">
          <span className="mr-auto text-[11px] text-text-tertiary">
            or reply with changes to adjust
          </span>
          <button
            type="button"
            disabled={isBusy}
            onClick={onApprove}
            className="flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            title="Approve and let the coworker perform this action"
          >
            {isBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
            Approve &amp; run
          </button>
        </div>
      )}
    </div>
  );
}
