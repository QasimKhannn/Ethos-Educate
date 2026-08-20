import { useState } from 'react';
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="essay-grader-copy-feedback-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6"
    >
      <div className="flex max-h-[88vh] w-full max-w-md flex-col rounded-2xl border border-border-light bg-surface-primary shadow-2xl dark:border-white/10">
        <div className="flex items-start justify-between gap-4 border-b border-border-light px-5 py-4 dark:border-white/10">
          <div>
            <h2
              id="essay-grader-copy-feedback-title"
              className="text-lg font-semibold text-text-primary"
            >
              Copy feedback
            </h2>
            <p className="mt-1 text-sm text-text-secondary">Select the sections to include.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-text-secondary transition-colors hover:bg-surface-secondary hover:text-text-primary"
            aria-label="Close"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          <label className="flex items-center gap-2.5 border-b border-border-light pb-3 dark:border-white/10">
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
            <span className="text-sm font-semibold text-text-primary">All sections (complete)</span>
          </label>

          {(['Overview', 'Detailed', 'Extra'] as const).map((group) => (
            <div key={group} className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">
                {group}
              </p>
              <div className="mt-2 space-y-2">
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

        <div className="border-t border-border-light px-5 py-4 dark:border-white/10">
          <button
            type="button"
            onClick={() => void copy()}
            className={cn(
              'flex h-11 w-full items-center justify-center rounded-xl text-sm font-semibold text-white transition-colors',
              'bg-blue-600 hover:bg-blue-500',
            )}
          >
            {copied ? 'Copied' : 'Copy to clipboard'}
          </button>
        </div>
      </div>
    </div>
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
