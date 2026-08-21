import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '~/utils';
import type { GradingResponse } from './types';

/**
 * Copy the feedback out, in the shape the person actually needs.
 *
 * The result page is not where feedback gets used — it is pasted into a
 * gradebook comment box, an email, or a printed sheet, and each of those
 * wants a different subset. Plain text, not HTML or Markdown, since the
 * destinations are comment boxes that strip formatting.
 *
 * Ported from the standalone Co-grader app's `CopyFeedbackDialog.tsx`
 * (`buildText()` is unchanged — it's pure data shaping); the dialog chrome
 * is reskinned to match this file's existing `CustomRubricModal` overlay
 * pattern instead of the standalone app's native `<dialog>` element.
 */
const SECTIONS = [
  { key: 'summary', label: 'Summary', group: 'Overview' },
  { key: 'rubric', label: 'Rubric scores and feedback', group: 'Detailed' },
  { key: 'evidence', label: 'Comments / highlights', group: 'Extra' },
  { key: 'nextSteps', label: 'Strengths and next steps', group: 'Extra' },
  { key: 'metrics', label: 'Word and sentence counts', group: 'Extra' },
] as const;

type SectionKey = (typeof SECTIONS)[number]['key'];

export function CopyFeedbackDialog({
  response,
  onClose,
}: {
  response: GradingResponse;
  onClose: () => void;
}) {
  const [chosen, setChosen] = useState<Record<SectionKey, boolean>>({
    summary: true,
    rubric: true,
    evidence: true,
    nextSteps: true,
    metrics: false,
  });
  const [copied, setCopied] = useState(false);

  const allOn = SECTIONS.every((section) => chosen[section.key]);
  const preview = useMemo(() => buildText(response, chosen), [response, chosen]);

  // Portaled to `document.body` — see `EssayReviewDialog` for why: this
  // route sits under an app-shell ancestor with a CSS transform, which
  // breaks `fixed inset-0` positioning (it resolves against that ancestor's
  // box instead of the real viewport) unless the dialog escapes it.

  function toggle(key: SectionKey) {
    setChosen((current) => ({ ...current, [key]: !current[key] }));
    setCopied(false);
  }

  async function copy() {
    const text = buildText(response, chosen);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      const area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
      setCopied(true);
    }
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="essay-grader-copy-feedback-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6"
    >
      {/*
        Two panes instead of one stacked checklist: pick sections on the
        left, see exactly what will land on the clipboard on the right. A
        checklist-then-blind-copy flow makes you guess at the result; this
        one shows it before you commit to it. Ported from the same change in
        the standalone Co-grader app.
      */}
      <div className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border-light bg-surface-primary shadow-2xl dark:border-white/10 sm:flex-row">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-text-secondary transition-colors hover:bg-surface-secondary hover:text-text-primary"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>

        <div className="w-full shrink-0 overflow-y-auto border-b border-border-light p-5 pr-10 dark:border-white/10 sm:w-56 sm:border-b-0 sm:border-r sm:pr-5">
          <h2 id="essay-grader-copy-feedback-title" className="text-base font-bold text-text-primary">
            Copy feedback
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-text-secondary">Choose what&apos;s included.</p>

          <label className="mt-4 flex items-center gap-2.5 rounded-xl border border-border-light bg-surface-secondary/60 px-3 py-2.5 dark:border-white/10">
            <input
              type="checkbox"
              checked={allOn}
              onChange={() => {
                const next = !allOn;
                setChosen(
                  Object.fromEntries(SECTIONS.map((s) => [s.key, next])) as Record<
                    SectionKey,
                    boolean
                  >,
                );
                setCopied(false);
              }}
              className="h-4 w-4 accent-blue-600"
            />
            <span className="text-sm font-semibold text-text-primary">All sections</span>
          </label>

          <div className="mt-4 space-y-4">
            {(['Overview', 'Detailed', 'Extra'] as const).map((group) => (
              <div key={group}>
                <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">
                  {group}
                </p>
                <div className="mt-1.5 space-y-1.5">
                  {SECTIONS.filter((section) => section.group === group).map((section) => (
                    <label key={section.key} className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={chosen[section.key]}
                        onChange={() => toggle(section.key)}
                        className="h-4 w-4 accent-blue-600"
                      />
                      <span className="text-sm text-text-primary">{section.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">Preview</p>
            {preview ? (
              <pre className="mt-2 whitespace-pre-wrap font-sans text-sm leading-relaxed text-text-primary">
                {preview}
              </pre>
            ) : (
              <p className="mt-2 text-sm text-text-tertiary">
                Select a section on the left to see what gets copied.
              </p>
            )}
          </div>
          <div className="border-t border-border-light bg-surface-secondary/40 p-4 dark:border-white/10">
            <button
              type="button"
              onClick={() => void copy()}
              disabled={!preview}
              className={cn(
                'flex h-11 w-full items-center justify-center rounded-xl text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                'bg-blue-600 hover:bg-blue-500',
              )}
            >
              {copied ? 'Copied' : 'Copy to clipboard'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function buildText(response: GradingResponse, chosen: Record<SectionKey, boolean>): string {
  const { result } = response;
  const blocks: string[] = [];

  if (response.title) blocks.push(response.title);

  if (chosen.summary && result.overallComment) {
    blocks.push(result.overallComment);
  }

  if (chosen.summary && result.total) {
    blocks.push(
      `Total: ${result.total.points} / ${result.total.maxPoints} (${result.total.percentage}%)`,
    );
  }

  if (chosen.rubric && result.criteria.length > 0) {
    const lines = result.criteria.map((criterion, index) => {
      const score =
        criterion.points === null
          ? (criterion.levelLabel ?? '')
          : `${criterion.points}/${criterion.maxPoints}`;
      const head = `${index + 1}) ${criterion.name}${score ? ` — ${score}` : ''}`;
      const parts = [head, criterion.rationale];

      if (chosen.evidence && criterion.evidence.length > 0) {
        for (const span of criterion.evidence) {
          parts.push(`   "${span.quote}"${span.note ? ` — ${span.note}` : ''}`);
        }
      }
      return parts.join('\n');
    });
    blocks.push(lines.join('\n\n'));
  }

  if (chosen.evidence && result.criteria.length === 0 && result.generalEvidence.length > 0) {
    blocks.push(
      result.generalEvidence
        .map((span) => `"${span.quote}"${span.note ? ` — ${span.note}` : ''}`)
        .join('\n'),
    );
  }

  if (chosen.nextSteps) {
    if (result.strengths.length > 0) {
      blocks.push(`What is working:\n${result.strengths.map((s) => `- ${s}`).join('\n')}`);
    }
    if (result.nextSteps.length > 0) {
      blocks.push(`Do next:\n${result.nextSteps.map((s) => `- ${s}`).join('\n')}`);
    }
  }

  if (chosen.metrics && result.metrics) {
    const m = result.metrics;
    blocks.push(
      `${m.words} words, ${m.sentences} sentences, ${m.paragraphs} paragraphs, averaging ${m.averageSentenceWords} words a sentence.`,
    );
  }

  return blocks.join('\n\n').trim();
}
