import { X } from 'lucide-react';
import { OGDialog, OGDialogContent, OGDialogTitle } from '@librechat/client';
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

  return (
    <OGDialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      modal
    >
      <OGDialogContent
        showCloseButton={false}
        overlayClassName="bg-black/45"
        className="relative flex max-h-[85vh] max-w-2xl flex-col gap-0 overflow-hidden rounded-2xl border border-border-light bg-surface-primary p-0 shadow-2xl dark:border-white/10"
      >
        <OGDialogTitle className="sr-only">{filename}</OGDialogTitle>
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

        <div className="bg-surface-secondary/40 border-t border-border-light p-4 dark:border-white/10">
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
      </OGDialogContent>
    </OGDialog>
  );
}
