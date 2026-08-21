import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, Clock, Loader2, XCircle } from 'lucide-react';
import { cn } from '~/utils';
import { fetchBatch } from './api';
import type { BatchItemSummary, BatchStatus, BatchSummary } from './types';

const TERMINAL: BatchStatus[] = ['COMPLETE', 'FAILED'];
const POLL_MS = 2000;

/**
 * The landing screen right after a batch is submitted — every essay in the
 * batch, its status, and its score once graded. Polls the batch until every
 * row reaches a terminal state, then stops. Ported from the standalone
 * Co-grader app's `BatchOverview.tsx`, restyled to Ethos Educate's tokens.
 */
export function BatchOverview({
  batch,
  onUpdate,
  onOpenItem,
  onBack,
}: {
  batch: BatchSummary;
  onUpdate: (next: BatchSummary) => void;
  onOpenItem: (item: BatchItemSummary) => void;
  onBack: () => void;
}) {
  const [polling, setPolling] = useState(true);
  const batchIdRef = useRef(batch.batchId);
  batchIdRef.current = batch.batchId;

  useEffect(() => {
    let cancelled = false;
    setPolling(true);

    const tick = async () => {
      try {
        const next = await fetchBatch(batchIdRef.current);
        if (cancelled) return;
        onUpdate(next);
        if (next.items.every((item) => TERMINAL.includes(item.status))) {
          setPolling(false);
        }
      } catch {
        // A transient network blip shouldn't stop polling — the next tick
        // just tries again. If it's permanent the visitor will see the
        // batch stuck on its last known state, which is honest enough.
      }
    };

    const interval = window.setInterval(() => void tick(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batch.batchId]);

  const completedCount = batch.items.filter((item) => TERMINAL.includes(item.status)).length;
  const failedCount = batch.items.filter((item) => item.status === 'FAILED').length;

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
            Grade another batch
          </button>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">Batch results</h1>
          <p className="mt-1 text-sm text-text-secondary">
            {polling
              ? `Grading ${completedCount} of ${batch.items.length} essays…`
              : failedCount > 0
                ? `${completedCount - failedCount} of ${batch.items.length} essays graded, ${failedCount} failed.`
                : `All ${batch.items.length} essays graded.`}
          </p>
        </div>
        {polling ? (
          <Loader2 className="h-5 w-5 shrink-0 animate-spin text-blue-500" aria-hidden="true" />
        ) : null}
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
                  title={item.status === 'FAILED' ? (item.error ?? 'Grading failed.') : undefined}
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
                    <StatusPill status={item.status} />
                  </td>
                  <td className="px-5 py-3 font-semibold text-text-primary">
                    {item.score ? `${item.score.points}/${item.score.maxPoints} · ${item.score.percentage}%` : '—'}
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

function StatusPill({ status }: { status: BatchStatus }) {
  const config: Record<BatchStatus, { label: string; className: string; icon: typeof Clock }> = {
    PENDING: {
      label: 'Queued',
      className: 'border-border-light text-text-secondary dark:border-white/10',
      icon: Clock,
    },
    PROCESSING: {
      label: 'Grading…',
      className: 'border-blue-400/40 bg-blue-500/10 text-blue-600 dark:text-blue-300',
      icon: Loader2,
    },
    COMPLETE: {
      label: 'Complete',
      className: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
      icon: CheckCircle2,
    },
    FAILED: {
      label: 'Failed',
      className: 'border-red-400/40 bg-red-500/10 text-red-500',
      icon: XCircle,
    },
  };

  const { label, className, icon: Icon } = config[status];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold',
        className,
      )}
    >
      <Icon className={cn('h-3.5 w-3.5', status === 'PROCESSING' && 'animate-spin')} aria-hidden="true" />
      {label}
    </span>
  );
}
