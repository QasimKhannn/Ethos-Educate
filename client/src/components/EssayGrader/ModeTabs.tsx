import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '~/utils';
import { runGradingMode, EssayGraderApiError } from './api';
import type { GradingMode, GradingResponse } from './types';

export interface ToolMode {
  mode: GradingMode;
  label: string;
  /** Shown under the tab row while this mode is selected. */
  returns: string;
  needsRubric: boolean;
}

/** The four things this submission can be read for. Mirrors the standalone
 *  Co-grader app's `TOOL_MODES` (`frontend/src/config/marketing.ts`). */
export const TOOL_MODES: ToolMode[] = [
  {
    mode: 'SCORE',
    label: 'Score it',
    returns: 'Points per criterion, a total, and highlighted evidence.',
    needsRubric: true,
  },
  {
    mode: 'FEEDBACK',
    label: 'Comment on it',
    returns: 'A comment per criterion and what would move it up a band.',
    needsRubric: true,
  },
  {
    mode: 'IMPROVE',
    label: 'Improve it',
    returns: 'Priority-ordered suggestions, tied to specific sentences.',
    needsRubric: false,
  },
  {
    mode: 'PROOFREAD',
    label: 'Check grammar',
    returns: 'Spelling, grammar, punctuation and clarity issues, sentence by sentence.',
    needsRubric: false,
  },
];

export const MODE_LABEL: Record<GradingMode, string> = {
  SCORE: 'Score',
  FEEDBACK: 'Comments',
  IMPROVE: 'Improve',
  PROOFREAD: 'Grammar check',
};

export function modeNeedsRubric(mode: GradingMode): boolean {
  return mode === 'SCORE' || mode === 'FEEDBACK';
}

/**
 * Switch what the same submission is read for, without leaving the result.
 *
 * A mode already in `availableModes` is served from the stored result —
 * instant, and no allowance spent. One that is not is a real model call, so
 * the tab says so before it is clicked rather than after.
 *
 * Ported from the standalone Co-grader app's `ModeTabs.tsx`, restyled to
 * Ethos Educate's existing tokens (blue accent, `border-border-light`,
 * `text-text-*`, dark-mode variants) instead of the standalone app's yellow
 * "highlight" accent.
 */
export function ModeTabs({
  response,
  onResult,
}: {
  response: GradingResponse;
  onResult: (next: GradingResponse) => void;
}) {
  const [pending, setPending] = useState<GradingMode | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rubricless = response.result.rubric === null;

  async function choose(mode: GradingMode) {
    if (mode === response.mode || pending) return;

    setPending(mode);
    setError(null);
    try {
      onResult(await runGradingMode(response.id, mode));
    } catch (cause) {
      setError(
        cause instanceof EssayGraderApiError
          ? cause.message
          : 'That did not work. Please try again in a moment.',
      );
    } finally {
      setPending(null);
    }
  }

  return (
    <div>
      <div
        role="tablist"
        aria-label="What to read this submission for"
        className="bg-surface-secondary/60 flex flex-wrap gap-1 rounded-xl border border-border-light p-1 dark:border-white/10"
      >
        {TOOL_MODES.map((option) => {
          const selected = option.mode === response.mode;
          const unavailable = rubricless && option.needsRubric;

          return (
            <button
              key={option.mode}
              role="tab"
              type="button"
              aria-selected={selected}
              disabled={pending !== null || unavailable}
              onClick={() => choose(option.mode)}
              title={
                unavailable
                  ? 'This submission was graded without a rubric, so it cannot be scored.'
                  : undefined
              }
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
                selected
                  ? 'bg-surface-primary text-text-primary shadow-sm'
                  : 'text-text-secondary hover:text-text-primary',
                (pending !== null || unavailable) && 'cursor-not-allowed opacity-60',
              )}
            >
              {pending === option.mode && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
              {option.label}
            </button>
          );
        })}
      </div>

      {error && (
        <p
          role="alert"
          className="mt-2 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-500"
        >
          {error}
        </p>
      )}
    </div>
  );
}
