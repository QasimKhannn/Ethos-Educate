import { Fragment } from 'react';
import { cn } from '~/utils';

export interface TextHighlight {
  start: number;
  end: number;
  polarity: 'STRENGTH' | 'GROWTH';
  /** Groups spans so one criterion can be isolated. */
  groupId: string | null;
  /** Shown on hover. */
  label?: string;
}

/**
 * Renders text with overlapping highlights.
 *
 * The text is cut at every highlight boundary into a flat list of segments,
 * and each segment is styled by whichever highlights cover it. Nesting
 * `<mark>` elements would be the obvious approach and it does not survive
 * overlap — two spans that partially overlap cannot both be an ancestor of
 * the same text — so this flattens first and lets a segment carry more than
 * one attribution.
 *
 * Nothing here trusts a highlight blindly: spans outside the text are
 * dropped, because a span indexing past the end of the string would silently
 * truncate everything after it.
 *
 * Ported from the standalone Co-grader app's `HighlightedText.tsx` — same
 * algorithm, recoloured to Ethos Educate's existing palette (amber for a
 * growth note, emerald for a strength) instead of the standalone app's
 * brand/highlight tokens, which don't exist here.
 */
export function HighlightedText({
  text,
  highlights,
  activeGroupId = null,
  className,
}: {
  text: string;
  highlights: TextHighlight[];
  /** When set, only this group is coloured; the rest fades back. */
  activeGroupId?: string | null;
  className?: string;
}) {
  const valid = highlights.filter((h) => h.start >= 0 && h.end <= text.length && h.end > h.start);

  const boundaries = new Set<number>([0, text.length]);
  for (const h of valid) {
    boundaries.add(h.start);
    boundaries.add(h.end);
  }
  const points = [...boundaries].sort((a, b) => a - b);

  const segments: Array<{ text: string; covering: TextHighlight[] }> = [];
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i];
    const end = points[i + 1];
    if (end <= start) continue;
    segments.push({
      text: text.slice(start, end),
      covering: valid.filter((h) => h.start <= start && h.end >= end),
    });
  }

  return (
    <div className={cn('whitespace-pre-wrap text-sm leading-7 text-text-primary', className)}>
      {segments.map((segment, index) => {
        if (segment.covering.length === 0) {
          return <Fragment key={index}>{segment.text}</Fragment>;
        }

        const isActive =
          activeGroupId === null || segment.covering.some((h) => h.groupId === activeGroupId);
        const hasGrowth = segment.covering.some((h) => h.polarity === 'GROWTH');
        const label = segment.covering
          .map((h) => h.label)
          .filter(Boolean)
          .join(' · ');

        return (
          <mark
            key={index}
            title={label || undefined}
            className={cn(
              'rounded px-px transition-colors',
              !isActive && 'bg-transparent text-text-secondary',
              isActive &&
                hasGrowth &&
                'bg-amber-400/25 text-text-primary dark:bg-amber-400/20',
              isActive &&
                !hasGrowth &&
                'bg-emerald-400/25 text-text-primary dark:bg-emerald-400/20',
              isActive &&
                segment.covering.length > 1 &&
                'underline decoration-blue-500/50 decoration-2 underline-offset-4',
            )}
          >
            {segment.text}
          </mark>
        );
      })}
    </div>
  );
}
