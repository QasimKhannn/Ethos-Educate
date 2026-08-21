import { useRef, useState } from 'react';
import { Eye, FileText, Loader2, Trash2, Upload } from 'lucide-react';
import { cn } from '~/utils';
import { extractDocument, EssayGraderApiError } from './api';
import { EssayReviewDialog } from './EssayReviewDialog';

export type BatchFileStatus = 'reading' | 'ready' | 'error';

export interface BatchFile {
  id: string;
  name: string;
  status: BatchFileStatus;
  text: string | null;
  title: string;
  error: string | null;
}

export const MAX_BATCH_FILES = 40;
const EXTRACTION_CONCURRENCY = 3;

let nextFileId = 0;
const newFileId = () => `batch-file-${(nextFileId += 1)}-${Date.now()}`;

/**
 * Multi-file upload for a batch — the batch equivalent of step 2's single
 * essay upload. Extraction runs client-side, a few files at a time, against
 * the same `/public/extract` endpoint the single-essay flow already uses;
 * each file's extraction succeeds or fails independently so one bad upload
 * (password-protected docx, scanned PDF) never blocks the rest.
 *
 * Ported from the standalone Co-grader app's `BatchSubmissionPanel.tsx`,
 * restyled to Ethos Educate's tokens. Two lessons learned building that
 * version are applied here from the start rather than re-discovered:
 * (1) `HTMLInputElement.files` is a live `FileList` tied to the element, so
 * it is snapshotted into a plain `File[]` array *before* `input.value` is
 * reset — resetting first and reading the list after silently empties it;
 * (2) clicking a ready file opens it for review (title + extracted text),
 * not an inline rename — renaming a file nobody will read again is not
 * useful, seeing what will actually be graded is.
 */
export function BatchSubmissionPanel({
  files,
  onFilesChange,
  disabled = false,
}: {
  files: BatchFile[];
  onFilesChange: (updater: (current: BatchFile[]) => BatchFile[]) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const reviewingFile = files.find((file) => file.id === reviewingId) ?? null;

  async function addFiles(incoming: File[]) {
    setPickError(null);
    if (incoming.length === 0) return;

    const room = MAX_BATCH_FILES - files.length;
    if (room <= 0) {
      setPickError(`A batch can hold at most ${MAX_BATCH_FILES} essays.`);
      return;
    }
    const accepted = incoming.slice(0, room);
    if (accepted.length < incoming.length) {
      setPickError(
        `Only ${accepted.length} of ${incoming.length} file${incoming.length === 1 ? '' : 's'} were added — a batch can hold at most ${MAX_BATCH_FILES} essays.`,
      );
    }

    const entries: BatchFile[] = accepted.map((file) => ({
      id: newFileId(),
      name: file.name,
      status: 'reading',
      text: null,
      title: file.name.replace(/\.[^.]+$/, ''),
      error: null,
    }));

    onFilesChange((current) => [...current, ...entries]);

    // A small fixed worker pool pulling from a shared queue — same shape as
    // the backend's batch grading concurrency limiter, just in the browser.
    let cursor = 0;
    async function worker() {
      while (cursor < accepted.length) {
        const index = cursor;
        cursor += 1;
        const file = accepted[index];
        const entry = entries[index];
        try {
          const extracted = await extractDocument(file);
          onFilesChange((current) =>
            current.map((item) =>
              item.id === entry.id
                ? { ...item, status: 'ready', text: extracted.text, title: item.title || extracted.filename.replace(/\.[^.]+$/, '') }
                : item,
            ),
          );
        } catch (cause) {
          const message =
            cause instanceof EssayGraderApiError ? cause.message : 'Could not read this file.';
          onFilesChange((current) =>
            current.map((item) => (item.id === entry.id ? { ...item, status: 'error', error: message } : item)),
          );
        }
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(EXTRACTION_CONCURRENCY, accepted.length) }, () => worker()),
    );
  }

  function handleInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    // Snapshot into a plain array before resetting `.value` — `.files` is a
    // live FileList tied to this element, and resetting first empties it,
    // so a later read of `event.target.files` here would silently see zero.
    const picked = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (picked.length > 0) void addFiles(picked);
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (disabled) return;
    const dropped = Array.from(event.dataTransfer.files ?? []);
    if (dropped.length > 0) void addFiles(dropped);
  }

  function removeFile(id: string) {
    onFilesChange((current) => current.filter((file) => file.id !== id));
    if (reviewingId === id) setReviewingId(null);
  }

  function updateReviewing(patch: Partial<Pick<BatchFile, 'title' | 'text'>>) {
    if (!reviewingId) return;
    onFilesChange((current) =>
      current.map((file) => (file.id === reviewingId ? { ...file, ...patch } : file)),
    );
  }

  const readyCount = files.filter((file) => file.status === 'ready').length;

  return (
    <div className="space-y-3">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={cn(
          'flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-colors',
          dragging ? 'border-blue-400 bg-blue-500/10' : 'border-border-light dark:border-white/10',
        )}
      >
        <Upload className="h-6 w-6 text-text-tertiary" aria-hidden="true" />
        <p className="text-sm font-semibold text-text-primary">
          Drag essays here, or{' '}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={disabled}
            className="text-blue-500 underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-60"
          >
            add files
          </button>
        </p>
        <p className="text-xs text-text-tertiary">
          Up to {MAX_BATCH_FILES} essays · .docx, .pdf, .txt, .md, .rtf
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".docx,.pdf,.txt,.md,.rtf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,application/rtf,text/rtf"
          onChange={handleInputChange}
          disabled={disabled}
          className="sr-only"
          tabIndex={-1}
        />
      </div>

      {pickError ? (
        <p className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-600 dark:text-amber-300">
          {pickError}
        </p>
      ) : null}

      {files.length > 0 ? (
        <ul className="divide-y divide-border-light overflow-hidden rounded-2xl border border-border-light dark:divide-white/10 dark:border-white/10">
          {files.map((file) => (
            <li key={file.id} className="flex items-center gap-3 bg-surface-primary px-4 py-3">
              <FileText className="h-4 w-4 shrink-0 text-text-tertiary" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                {file.status === 'ready' ? (
                  <button
                    type="button"
                    onClick={() => setReviewingId(file.id)}
                    className="flex min-w-0 items-center gap-2 text-left"
                  >
                    <span className="truncate text-sm font-semibold text-text-primary">
                      {file.title || file.name}
                    </span>
                    <Eye className="h-3.5 w-3.5 shrink-0 text-text-tertiary" aria-hidden="true" />
                  </button>
                ) : (
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-text-primary">{file.name}</p>
                    {file.status === 'reading' ? (
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-text-tertiary">
                        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                        Reading…
                      </p>
                    ) : (
                      <p className="mt-0.5 text-xs text-red-500">{file.error}</p>
                    )}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => removeFile(file.id)}
                aria-label={`Remove ${file.name}`}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-text-tertiary transition-colors hover:bg-surface-secondary hover:text-text-primary"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="text-xs text-text-tertiary">
        {readyCount} of {files.length} essay{files.length === 1 ? '' : 's'} ready
        {files.length > 0 && readyCount < 2 ? ' — a batch needs at least two.' : '.'}
      </p>

      {reviewingFile ? (
        <EssayReviewDialog
          filename={reviewingFile.name}
          title={reviewingFile.title}
          text={reviewingFile.text ?? ''}
          onChangeTitle={(title) => updateReviewing({ title })}
          onChangeText={(text) => updateReviewing({ text })}
          onClose={() => setReviewingId(null)}
        />
      ) : null}
    </div>
  );
}
