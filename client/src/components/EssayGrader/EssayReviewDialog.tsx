import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '~/utils';

const countWords = (value: string) => value.trim().split(/\s+/).filter(Boolean).length;

/**
 * Review, and fix if needed, one essay's extracted text before a batch is
 * graded — the batch equivalent of the single-essay form's textarea, where
 * seeing what actually came out of a file is the difference between a
 * fixable annoyance and a wrong score. Edits apply live; there is nothing to
 * save separately, only to close once it looks right.
 *
 * Ported from the standalone Co-grader app's `EssayReviewDialog.tsx`,
 * reskinned to this file's existing `CopyFeedbackDialog.tsx` overlay-div
 * pattern instead of the standalone app's native `<dialog>` element.
 */
export function EssayReviewDialog({
  filename,
  title,
  text,
  onChangeTitle,
  onChangeText,
  onClose,
}: {
  filename: string;
  title: string;
  text: string;
  onChangeTitle: (title: string) => void;
  onChangeText: (text: string) => void;
  onClose: () => void;
}) {
  const words = countWords(text);

  // Portaled straight to `document.body`. This dialog opens from deep
  // inside the wizard's step-2 form, which sits under an app-shell ancestor
  // with a CSS transform (used for the shell's page-transition animation).
  // A transformed ancestor becomes the containing block for any `fixed`
  // descendant, so left un-portaled `fixed inset-0` resolves against that
  // ancestor's box instead of the real viewport — the overlay only covers
  // part of the screen and the card sits pinned near the top instead of
  // centered. Rendering into `document.body` escapes that ancestor chain
  // entirely, so `fixed inset-0` means the actual screen again.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="essay-review-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6"
    >
      <div className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border-light bg-surface-primary shadow-2xl dark:border-white/10">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-text-secondary transition-colors hover:bg-surface-secondary hover:text-text-primary"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>

        <div className="border-b border-border-light px-5 py-4 pr-12 dark:border-white/10">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">
            {filename}
          </p>
          <input
            id="essay-review-dialog-title"
            value={title}
            onChange={(event) => onChangeTitle(event.target.value)}
            placeholder="Title"
            className="mt-1 w-full border-0 bg-transparent p-0 text-lg font-bold text-text-primary outline-none focus:ring-0"
          />
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <textarea
            value={text}
            onChange={(event) => onChangeText(event.target.value)}
            spellCheck={false}
            rows={16}
            className="block w-full resize-y rounded-xl border border-border-light bg-surface-primary p-3 text-sm leading-relaxed text-text-primary outline-none transition-colors focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 dark:border-white/10"
          />
          <p className="mt-2 text-xs text-text-tertiary">
            {words.toLocaleString()} word{words === 1 ? '' : 's'} — this is exactly what will be
            graded. Fix anything the extraction got wrong before grading the batch.
          </p>
        </div>

        <div className="border-t border-border-light bg-surface-secondary/40 p-4 dark:border-white/10">
          <button
            type="button"
            onClick={onClose}
            className={cn(
              'flex h-11 w-full items-center justify-center rounded-xl text-sm font-semibold text-white transition-colors',
              'bg-blue-600 hover:bg-blue-500',
            )}
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
