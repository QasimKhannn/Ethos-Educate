import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '~/utils';
import type { BatchDetectionItemSummary, BatchDetectionSummary, DetectionBand } from './types';

const BAND_PILL: Record<DetectionBand, string> = {
  INCONCLUSIVE: 'border-border-light text-text-secondary dark:border-white/10',
  LOW: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
  MEDIUM: 'border-amber-400/40 bg-amber-500/10 text-amber-600 dark:text-amber-300',
  HIGH: 'border-orange-400/40 bg-orange-500/10 text-orange-600 dark:text-orange-300',
};

/**
 * The landing screen right after a detection batch is submitted: one row
 * per essay, each already fully analyzed. Deliberately **not** `BatchOverview`
 * with a flag, and deliberately has no polling loop -- grading's batch needs
 * polling because each row starts PENDING and a background worker fills it
 * in over time, while a detection batch comes back with every row already
 * COMPLETE (analysis is synchronous; see the backend's
 * `DetectionService.createBatch`), so this just renders what it was handed.
 * `FAILED` is still handled defensively in case a future change ever makes
 * one possible, but nothing in today's engine produces it.
 *
 * Ported from the standalone Co-grader app's `DetectionBatchOverview.tsx`,
 * restyled to Ethos Educate's tokens and this file's own `BatchOverview.tsx`
 * layout.
 */
export function DetectionBatchOverview({
  batch,
  onOpenItem,
  onBack,
}: {
  batch: BatchDetectionSummary;
  onOpenItem: (item: BatchDetectionItemSummary) => void;
  onBack: () => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-5 py-6 md:px-8 xl:px-12">
      <header className="bg-surface-primary/85 dark:bg-surface-primary/45 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border-light p-5 shadow-sm backdrop-blur dark:border-white/10">
        <div className="min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-text-secondary transition-colors hover:text-text-primary"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            Analyze another batch
          </button>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">Batch results</h1>
          <p className="mt-1 text-sm text-text-secondary">
            {batch.items.length} essay{batch.items.length === 1 ? '' : 's'} analyzed.
          </p>
        </div>
      </header>

      <div className="overflow-hidden rounded-2xl border border-border-light bg-surface-primary/80 shadow-sm dark:border-white/10 dark:bg-surface-primary/40">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border-light text-xs font-semibold uppercase tracking-wide text-text-tertiary dark:border-white/10">
              <th className="px-5 py-3 font-semibold">Essay</th>
              <th className="px-5 py-3 font-semibold">Words</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 font-semibold">Score</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {batch.items.map((item) => {
              const openable = item.status === 'COMPLETE';
              return (
                <tr
                  key={item.id}
                  onClick={openable ? () => onOpenItem(item) : undefined}
                  title={item.status === 'FAILED' ? (item.error ?? 'Analysis failed.') : undefined}
                  className={cn(
                    'border-b border-border-light last:border-b-0 dark:border-white/10',
                    openable && 'cursor-pointer transition-colors hover:bg-surface-secondary/60',
                  )}
                >
                  <td className="max-w-xs truncate px-5 py-3 font-semibold text-text-primary">
                    {item.title || `Essay ${item.batchIndex + 1}`}
                  </td>
                  <td className="px-5 py-3 text-text-secondary">{item.wordCount.toLocaleString()}</td>
                  <td className="px-5 py-3">
                    <StatusPill item={item} />
                  </td>
                  <td className="px-5 py-3 font-semibold text-text-primary">
                    {item.overallSignalScore === null ? '—' : `${item.overallSignalScore}/100`}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {openable ? (
                      <ChevronRight className="ml-auto h-4 w-4 text-text-tertiary" aria-hidden="true" />
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusPill({ item }: { item: BatchDetectionItemSummary }) {
  if (item.status === 'FAILED') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-red-400/40 bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-500">
        Failed
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold',
        BAND_PILL[item.band],
      )}
    >
      {item.overallSignalScore === null ? 'Inconclusive' : item.bandLabel}
    </span>
  );
}
