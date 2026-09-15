import { ChevronDown, ChevronUp } from 'lucide-react';
import type { ToolActivityPresentation } from './toolPresentation';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';

export type ToolActivityStatus = 'completed' | 'failed' | 'interrupted' | 'needs_auth' | 'working';

type ToolActivityCardProps = {
  hasDetails: boolean;
  isExpanded: boolean;
  onToggleDetails: () => void;
  presentation: ToolActivityPresentation;
  status: ToolActivityStatus;
};

export default function ToolActivityCard({
  hasDetails,
  isExpanded,
  onToggleDetails,
  presentation,
  status,
}: ToolActivityCardProps) {
  const localize = useLocalize();
  const statusText = (() => {
    if (status === 'completed') {
      return localize(presentation.completedKey);
    }
    if (status === 'failed') {
      return localize('com_ui_tool_activity_failed');
    }
    if (status === 'interrupted') {
      return localize('com_ui_tool_activity_interrupted');
    }
    if (status === 'needs_auth') {
      return localize('com_ui_tool_activity_needs_auth');
    }
    return localize(presentation.titleKey);
  })();

  const isWorking = status === 'working';
  const isProblem = status === 'failed' || status === 'interrupted';
  const liveStatus =
    status === 'working' ? localize('com_ui_tool_activity_in_progress') : statusText;
  const content = (
    <>
      <span
        className={cn(
          'min-w-0 text-sm font-medium text-text-secondary',
          isWorking && 'shimmer',
          isProblem && 'text-red-700',
        )}
      >
        {statusText}
      </span>
      {hasDetails &&
        (isExpanded ? (
          <ChevronUp className="size-4 shrink-0 text-text-secondary" aria-hidden="true" />
        ) : (
          <ChevronDown className="size-4 shrink-0 text-text-secondary" aria-hidden="true" />
        ))}
    </>
  );

  return (
    <div
      className="my-2 max-w-lg"
      data-tool-activity-category={presentation.category}
      data-tool-activity-status={status}
    >
      {hasDetails ? (
        <button
          type="button"
          className="inline-flex max-w-full items-center gap-1.5 rounded-sm text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-expanded={isExpanded}
          aria-label={localize('com_ui_tool_activity_technical_details')}
          onClick={onToggleDetails}
        >
          {content}
        </button>
      ) : (
        <div className="inline-flex max-w-full items-center gap-1.5">{content}</div>
      )}
      <span className="sr-only" role="status" aria-live="polite">
        {statusText + '. ' + liveStatus}
      </span>
      {isProblem && (
        <p className="mt-1 text-xs text-text-secondary">
          {localize('com_ui_tool_activity_problem_guidance')}
        </p>
      )}
    </div>
  );
}
