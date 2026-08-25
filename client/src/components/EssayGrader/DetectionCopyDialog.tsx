import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '~/utils';
import type { DetectionResponse } from './types';

/**
 * Copy a detection result out, the same "pick sections, preview, copy"
 * pattern as `CopyFeedbackDialog` (grading). Detection's shape is simpler --
 * no per-criterion breakdown -- so this has fewer sections, and unlike
 * grading's optional "metrics" section, the disclaimer here is never a
 * toggle: it is always appended, the same way it is always shown as a fixed
 * banner in `DetectionResultView` rather than something dismissible. A
 * score that travels without the disclaimer defeats the reason the
 * disclaimer exists.
 */
const SECTIONS = [
  { key: 'summary', label: 'Overall score and band', group: 'Overview' },
  { key: 'signals', label: 'Signal scores and descriptions', group: 'Detailed' },
  { key: 'evidence', label: 'Quoted evidence', group: 'Extra' },
] as const;

type SectionKey = (typeof SECTIONS)[number]['key'];

export function DetectionCopyDialog({
  response,
  onClose,
}: {
  response: DetectionResponse;
  onClose: () => void;
}) {
  const [chosen, setChosen] = useState<Record<SectionKey, boolean>>({
    summary: true,
    signals: true,
    evidence: true,
  });
  const [copied, setCopied] = useState(false);

  const allOn = SECTIONS.every((section) => chosen[section.key]);
  const preview = useMemo(() => buildDetectionText(response, chosen), [response, chosen]);

  function toggle(key: SectionKey) {
    setChosen((current) => ({ ...current, [key]: !current[key] }));
    setCopied(false);
  }

  async function copy() {
    const text = buildDetectionText(response, chosen);

    // Writing both a plain-text and an HTML clipboard entry is what makes
    // this look "formatted" once pasted into a rich-text destination (Word,
    // Google Docs, Gmail, most gradebook comment boxes): those editors read
    // text/html when it's present and render its bold headers and real
    // bullet lists, instead of the ALL-CAPS/dash plain-text fallback going
    // through verbatim. See `buildDetectionHtml`'s comment for more.
    try {
      if (typeof ClipboardItem !== 'undefined') {
        const html = buildDetectionHtml(response, chosen);
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/plain': new Blob([text], { type: 'text/plain' }),
            'text/html': new Blob([html], { type: 'text/html' }),
          }),
        ]);
        setCopied(true);
        return;
      }
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      // Plain text only at this point -- there is no rich-text equivalent
      // of execCommand('copy').
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
      aria-labelledby="detection-copy-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6"
    >
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
          <h2 id="detection-copy-title" className="text-base font-bold text-text-primary">
            Copy result
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-text-secondary">
            Choose what&apos;s included. The disclaimer is always added at the end.
          </p>

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

/**
 * The text that lands in the clipboard, organized so it reads clearly even
 * with no other context around it: each chosen section gets its own
 * ALL-CAPS header, and quotes/lists use a leading "- " rather than
 * indentation alone, since some paste destinations strip leading
 * whitespace but preserve a literal dash.
 */
export function buildDetectionText(
  response: DetectionResponse,
  chosen: Record<SectionKey, boolean>,
): string {
  const { result } = response;
  const blocks: string[] = [];

  if (response.title) blocks.push(response.title);

  if (chosen.summary) {
    blocks.push(
      result.overallSignalScore === null
        ? 'Inconclusive -- too short to analyze for these patterns.'
        : `${result.overallSignalScore}/100 -- ${result.bandLabel}`,
    );
  }

  if (chosen.signals && result.signals.length > 0) {
    const lines = result.signals.map((signal) => {
      const parts = [`${signal.label} -- ${signal.score}/100`, signal.description];
      if (chosen.evidence && signal.evidence.length > 0) {
        for (const span of signal.evidence) {
          parts.push(`- "${span.quote}"`);
        }
        if (signal.matchCount && signal.matchCount > signal.evidence.length) {
          parts.push(`(showing ${signal.evidence.length} of ${signal.matchCount} matches)`);
        }
      }
      return parts.join('\n');
    });
    blocks.push(['SIGNALS', ...lines].join('\n\n'));
  }

  // Never optional -- a score or signal breakdown should not travel without
  // the context of what this tool actually is and is not.
  blocks.push(result.disclaimer);

  return blocks.join('\n\n').trim();
}

/**
 * The `text/html` clipboard entry `copy()` writes alongside the plain text
 * above. A rich-text destination (Word, Google Docs, Gmail, most gradebook
 * comment boxes) reads this instead of the plain text when both are on the
 * clipboard, which is what turns "SIGNALS" and "- " bullets in the plain
 * version into an actual bold heading and a real bulleted list once pasted.
 * Structurally mirrors `buildDetectionText` block for block; every dynamic
 * value is escaped since it becomes literal HTML.
 */
function buildDetectionHtml(
  response: DetectionResponse,
  chosen: Record<SectionKey, boolean>,
): string {
  const { result } = response;
  const blocks: string[] = [];

  if (response.title) {
    blocks.push(`<h2 style="margin:0 0 12px;font-size:16px;">${escapeHtml(response.title)}</h2>`);
  }

  if (chosen.summary) {
    const summary =
      result.overallSignalScore === null
        ? 'Inconclusive -- too short to analyze for these patterns.'
        : `${result.overallSignalScore}/100 -- ${result.bandLabel}`;
    blocks.push(`<p style="margin:0 0 12px;"><strong>${escapeHtml(summary)}</strong></p>`);
  }

  if (chosen.signals && result.signals.length > 0) {
    const items = result.signals
      .map((signal) => {
        const evidence =
          chosen.evidence && signal.evidence.length > 0
            ? `<ul style="margin:4px 0 0;padding-left:20px;">${signal.evidence
                .map((span) => `<li>"${escapeHtml(span.quote)}"</li>`)
                .join('')}</ul>${
                signal.matchCount && signal.matchCount > signal.evidence.length
                  ? `<p style="margin:4px 0 0;font-style:italic;">(showing ${signal.evidence.length} of ${signal.matchCount} matches)</p>`
                  : ''
              }`
            : '';
        return `<li style="margin:0 0 10px;"><strong>${escapeHtml(signal.label)} -- ${signal.score}/100</strong><br>${escapeHtml(signal.description)}${evidence}</li>`;
      })
      .join('');
    blocks.push(
      `<h3 style="margin:0 0 8px;font-size:14px;">SIGNALS</h3><ul style="margin:0 0 12px;padding-left:20px;">${items}</ul>`,
    );
  }

  // Never optional, same rule as the plain-text version.
  blocks.push(`<p style="margin:0;font-style:italic;color:#666;">${escapeHtml(result.disclaimer)}</p>`);

  return blocks.join('');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
