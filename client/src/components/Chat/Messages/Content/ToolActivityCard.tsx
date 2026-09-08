import { useEffect, useMemo, useState } from 'react';
import { Skeleton, Spinner } from '@librechat/client';
import {
  BarChart3,
  Check,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  FileSearch,
  FileText,
  FolderSearch,
  ImageIcon,
  KeyRound,
  Search,
  WifiOff,
  Wrench,
} from 'lucide-react';
import type { ToolActivityCategory, ToolActivityPresentation } from './toolPresentation';
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

const activityIcons: Record<ToolActivityCategory, typeof Wrench> = {
  analysis: BarChart3,
  document: FileText,
  generic: Wrench,
  image: ImageIcon,
  knowledge: FileSearch,
  lesson: FileText,
  school_files: FolderSearch,
  web_search: Search,
  workspace: FolderSearch,
};

const statusIcon = (status: ToolActivityStatus) => {
  if (status === 'completed') {
    return <Check className="size-4" aria-hidden="true" />;
  }
  if (status === 'failed') {
    return <CircleAlert className="size-4" aria-hidden="true" />;
  }
  if (status === 'interrupted') {
    return <WifiOff className="size-4" aria-hidden="true" />;
  }
  if (status === 'needs_auth') {
    return <KeyRound className="size-4" aria-hidden="true" />;
  }
  return <Spinner className="size-4" />;
};

function ToolActivityPreview({ category }: { category: ToolActivityCategory }) {
  if (category === 'image') {
    return (
      <div
        className="relative mx-3 mb-3 h-44 max-w-sm overflow-hidden rounded-lg border border-border-light bg-surface-secondary"
        aria-hidden="true"
      >
        <Skeleton className="absolute inset-0" />
        <div className="relative z-10 flex h-full items-center justify-center">
          <div className="bg-surface-primary/80 flex size-12 items-center justify-center rounded-full text-brand-purple shadow-sm">
            <ImageIcon className="size-6" />
          </div>
        </div>
      </div>
    );
  }

  if (category === 'document' || category === 'lesson') {
    return (
      <div
        className="mx-3 mb-3 flex max-w-sm items-center gap-3 rounded-lg border border-border-light bg-surface-secondary px-4 py-3"
        aria-hidden="true"
      >
        <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-primary text-brand-purple shadow-sm">
          <FileText className="size-5" />
        </div>
        <div className="flex-1 space-y-2">
          <Skeleton className="h-2.5 w-3/4" />
          <Skeleton className="h-2.5 w-full" />
          <Skeleton className="h-2.5 w-2/3" />
        </div>
      </div>
    );
  }

  return null;
}

export default function ToolActivityCard({
  hasDetails,
  isExpanded,
  onToggleDetails,
  presentation,
  status,
}: ToolActivityCardProps) {
  const localize = useLocalize();
  const [phraseIndex, setPhraseIndex] = useState(0);
  const ActivityIcon = activityIcons[presentation.category];
  const title = localize(presentation.titleKey);
  const phraseKeys = presentation.workingPhraseKeys;

  useEffect(() => {
    setPhraseIndex(0);
    if (status !== 'working' || phraseKeys.length < 2) {
      return;
    }

    const timer = window.setInterval(() => {
      setPhraseIndex((currentIndex) => (currentIndex + 1) % phraseKeys.length);
    }, 3500);

    return () => window.clearInterval(timer);
  }, [phraseKeys, status]);

  const statusText = useMemo(() => {
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
    return localize(phraseKeys[phraseIndex] ?? 'com_ui_tool_activity_generic_working');
  }, [localize, phraseIndex, phraseKeys, presentation.completedKey, status]);

  const isWorking = status === 'working';
  const isProblem = status === 'failed' || status === 'interrupted';
  const liveStatus =
    status === 'working' ? localize('com_ui_tool_activity_in_progress') : statusText;

  return (
    <div
      className={cn(
        'my-3 max-w-lg overflow-hidden rounded-xl border bg-surface-primary shadow-sm transition-colors',
        isProblem ? 'border-red-300' : 'border-border-light',
      )}
      data-tool-activity-category={presentation.category}
      data-tool-activity-status={status}
    >
      <button
        type="button"
        className={cn(
          'flex w-full items-start gap-3 px-3 py-3 text-left transition-colors',
          hasDetails &&
            'hover:bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          !hasDetails && 'cursor-default',
        )}
        aria-expanded={hasDetails ? isExpanded : undefined}
        aria-label={hasDetails ? localize('com_ui_tool_activity_technical_details') : undefined}
        disabled={!hasDetails}
        onClick={hasDetails ? onToggleDetails : undefined}
      >
        <div
          className={cn(
            'mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg',
            isProblem ? 'bg-red-50 text-red-700' : 'bg-surface-secondary text-brand-purple',
          )}
        >
          <ActivityIcon className="size-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-text-primary">{title}</p>
          <p className={cn('mt-0.5 text-sm text-text-secondary', isWorking && 'shimmer')}>
            {statusText}
          </p>
          <span className="sr-only" aria-live="polite">
            {title + '. ' + liveStatus}
          </span>
          {isProblem && (
            <p className="mt-2 text-xs text-text-secondary">
              {localize('com_ui_tool_activity_problem_guidance')}
            </p>
          )}
        </div>
        <div
          className={cn(
            'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full',
            status === 'completed' && 'bg-brand-purple text-white',
            status === 'failed' && 'text-red-700',
            status === 'interrupted' && 'text-text-secondary',
            status === 'needs_auth' && 'text-brand-purple',
            status === 'working' && 'text-brand-purple',
          )}
        >
          {statusIcon(status)}
        </div>
        {hasDetails &&
          (isExpanded ? (
            <ChevronUp className="mt-1 size-4 shrink-0 text-text-secondary" aria-hidden="true" />
          ) : (
            <ChevronDown className="mt-1 size-4 shrink-0 text-text-secondary" aria-hidden="true" />
          ))}
      </button>
      {isWorking && <ToolActivityPreview category={presentation.category} />}
    </div>
  );
}
