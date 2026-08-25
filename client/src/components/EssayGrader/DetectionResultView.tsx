import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';
import { DetectionCopyDialog } from './DetectionCopyDialog';
import { HighlightedText, type TextHighlight } from './HighlightedText';
import type { DetectionBand, DetectionResponse, DetectionSignal } from './types';

/**
 * Renders one AI-writing-pattern detection result.
 *
 * Deliberately not a variant of `ResultView` in `EssayGraderRoute.tsx` --
 * this has no criteria, no points, no rubric, and none of the Comment/
 * Improve/Grammar tabs a grading result has. What it does share with that
 * view is the platform's one non-negotiable rule for anything that flags a
 * pattern in a submission: every claim has to be locatable in the text, so
 * this reuses `HighlightedText` the same way the grading result does.
 *
 * The disclaimer banner at the top is fixed, not a dismissible toast -- see
 * `claude/ai-detection-tool-research.md` in the project for why a tool like
 * this should never present a bare confident number without it.
 */

const BAND_STYLES: Record<DetectionBand, { badge: string; ring: string }> = {
  INCONCLUSIVE: {
    badge: 'bg-surface-secondary text-text-secondary',
    ring: 'text-text-tertiary',
  },
  LOW: {
    badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    ring: 'text-emerald-500',
  },
  MEDIUM: {
    badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    ring: 'text-amber-500',
  },
  HIGH: {
    badge: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
    ring: 'text-orange-500',
  },
};

export const DetectionResultView = ({
  response,
  onBack,
  batchNav,
}: {
  response: DetectionResponse;
  onBack: () => void;
  /**
   * Present when this result was opened by drilling into one essay from a
   * batch overview -- same shape as `ResultView`'s prop of the same name
   * further down in `EssayGraderRoute.tsx`. When set, both the corner
   * back-arrow and the "Analyze another" button return to the batch table
   * instead of resetting the whole tool.
   */
  batchNav?: {
    position: string;
    onPrev?: () => void;
    onNext?: () => void;
    onBackToBatch: () => void;
  };
}) => {
  const localize = useLocalize();
  const [activeSignalKey, setActiveSignalKey] = useState<string | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);
  const { result } = response;
  const title = response.title?.trim() || localize('com_essay_grader_untitled');
  const bandStyle = BAND_STYLES[result.band];

  const highlights = useMemo<TextHighlight[]>(
    () =>
      result.signals.flatMap((signal) =>
        signal.evidence.map((span) => ({
          start: span.start,
          end: span.end,
          polarity: 'GROWTH' as const,
          groupId: signal.key,
          label: `${signal.label}: "${span.quote}"`,
        })),
      ),
    [result.signals],
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-5 md:px-8 xl:px-10">
      <header className="overflow-hidden rounded-2xl border border-border-light shadow-sm dark:border-white/10">
        <div className="bg-surface-primary/85 dark:bg-surface-primary/45 flex flex-wrap items-center gap-4 border-b border-border-light px-4 py-3 backdrop-blur dark:border-white/10 sm:px-5">
          <button
            type="button"
            onClick={batchNav ? batchNav.onBackToBatch : onBack}
            aria-label={batchNav ? 'Back to batch' : 'Back'}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-text-secondary transition-colors hover:bg-surface-secondary hover:text-text-primary"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          {batchNav ? (
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={batchNav.onPrev}
                disabled={!batchNav.onPrev}
                aria-label="Previous essay"
                className="grid h-8 w-8 place-items-center rounded-lg text-text-secondary transition-colors hover:bg-surface-secondary hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>
              <span className="text-xs font-semibold text-text-tertiary">{batchNav.position}</span>
              <button
                type="button"
                onClick={batchNav.onNext}
                disabled={!batchNav.onNext}
                aria-label="Next essay"
                className="grid h-8 w-8 place-items-center rounded-lg text-text-secondary transition-colors hover:bg-surface-secondary hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">
              {batchNav ? 'Batch result' : 'AI writing patterns'}
            </p>
            <h1 className="truncate text-lg font-bold tracking-tight text-text-primary">{title}</h1>
          </div>
          <div className="hidden shrink-0 sm:block">
            <span
              className={cn(
                'inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-bold',
                bandStyle.badge,
              )}
            >
              {result.overallSignalScore === null ? 'Inconclusive' : `${result.overallSignalScore}/100`}
            </span>
          </div>
        </div>

        <div className="bg-surface-primary/85 dark:bg-surface-primary/45 flex flex-wrap items-center justify-between gap-3 p-3 backdrop-blur">
          <p className="text-sm font-semibold text-text-primary">{result.bandLabel}</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCopyOpen(true)}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-blue-600/40 bg-blue-500/10 px-4 text-sm font-semibold text-blue-600 transition-colors hover:bg-blue-500/20 dark:text-blue-400"
            >
              Copy
            </button>
            <button
              type="button"
              onClick={batchNav ? batchNav.onBackToBatch : onBack}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
            >
              {batchNav ? 'Back to batch' : 'Analyze another'}
            </button>
          </div>
        </div>
      </header>

      {copyOpen && <DetectionCopyDialog response={response} onClose={() => setCopyOpen(false)} />}

      <div className="flex items-start gap-3 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-900 dark:text-amber-200">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p>{result.disclaimer}</p>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(26rem,60%)_minmax(22rem,1fr)] xl:items-start">
        <section className="bg-surface-primary/80 dark:bg-surface-primary/40 flex min-h-[28rem] flex-col overflow-hidden rounded-2xl border border-border-light shadow-sm dark:border-white/10 xl:max-h-[calc(100vh-9rem)]">
          <div className="border-b border-border-light px-4 py-3 dark:border-white/10 sm:px-5">
            <h2 className="text-sm font-bold text-text-primary">Submission</h2>
            <p className="mt-1 text-xs text-text-secondary">
              {activeSignalKey
                ? 'Highlighting only the signal selected on the right — click it again to show all.'
                : 'Highlighted spans are what each signal below found. Click a signal to isolate it.'}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">
            {highlights.length > 0 ? (
              <HighlightedText
                text={response.text}
                highlights={highlights}
                activeGroupId={activeSignalKey}
                className="text-sm leading-7"
              />
            ) : (
              <pre className="whitespace-pre-wrap font-sans text-sm leading-7 text-text-primary">
                {response.text}
              </pre>
            )}
            <div className="sticky bottom-0 mt-4 flex justify-end">
              <span className="rounded-lg border border-border-light bg-surface-primary px-3 py-1.5 text-xs font-bold text-blue-500 shadow-sm dark:border-white/10">
                {response.wordCount.toLocaleString()} words
              </span>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          {result.signals.length > 0 && (
            <p className="text-xs leading-5 text-text-tertiary">
              Every score below means how strongly this submission matches the pattern named on
              the card -- a high score is never proof of AI writing, and a low score is never proof
              of human writing.
            </p>
          )}
          {result.signals.length === 0 ? (
            <div className="bg-surface-primary/80 dark:bg-surface-primary/40 rounded-2xl border border-border-light p-4 text-sm leading-6 text-text-secondary shadow-sm dark:border-white/10">
              This submission is too short for these signals to say anything meaningful. Try again with
              a longer piece of writing.
            </div>
          ) : (
            result.signals.map((signal) => (
              <SignalCard
                key={signal.key}
                signal={signal}
                active={activeSignalKey === signal.key}
                onClick={() =>
                  setActiveSignalKey((current) => (current === signal.key ? null : signal.key))
                }
              />
            ))
          )}
        </section>
      </div>
    </div>
  );
};

const SignalCard = ({
  signal,
  active,
  onClick,
}: {
  signal: DetectionSignal;
  active: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={signal.evidence.length === 0}
    className={cn(
      'bg-surface-primary/80 dark:bg-surface-primary/40 rounded-2xl border p-4 text-left shadow-sm transition-colors',
      active ? 'border-blue-400 ring-2 ring-blue-400/20' : 'border-border-light dark:border-white/10',
      signal.evidence.length === 0 && 'cursor-default',
    )}
  >
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm font-semibold text-text-primary">{signal.label}</p>
      <span className="shrink-0 rounded-full bg-surface-secondary px-2.5 py-1 text-xs font-bold text-text-primary">
        {signal.score}/100
      </span>
    </div>
    <p className="mt-2 text-xs leading-5 text-text-secondary">{signal.description}</p>
    {signal.matchCount ? (
      <p className="mt-1 text-xs font-medium text-text-tertiary">
        Showing {signal.evidence.length} of {signal.matchCount} matches.
      </p>
    ) : null}
  </button>
);
