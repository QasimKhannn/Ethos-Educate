import { useEffect, useMemo, useState } from 'react';
import DOMPurify from 'dompurify';
import { Check, Copy, Download } from 'lucide-react';
import { useLocalize } from '~/hooks';
import {
  createStudentCopyHtml,
  escapeStudentCopyHtml,
  getCompleteAdaptedStudentPlainText,
} from './differentiationAdapterResponse';
import type { DifferentiationAdapterResponse as DifferentiationAdapterResponseData } from './differentiationAdapterResponse';

const allowedTags = [
  'a',
  'b',
  'blockquote',
  'br',
  'caption',
  'div',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'hr',
  'i',
  'li',
  'ol',
  'p',
  'span',
  'strong',
  'table',
  'tbody',
  'td',
  'th',
  'thead',
  'tr',
  'u',
  'ul',
];

const allowedAttributes = ['colspan', 'href', 'rowspan', 'scope'];

function containsTitle(value: string, title: string): boolean {
  const heading = value.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i)?.[1];
  const headingText = heading
    ?.replace(/<[^>]+>/g, '')
    .trim()
    .toLocaleLowerCase();
  return headingText === title.trim().toLocaleLowerCase();
}

function getSafeDownloadUrl(value: string): string | null {
  try {
    const url = new URL(value, window.location.origin);
    return url.protocol === 'http:' || url.protocol === 'https:' ? value : null;
  } catch {
    return null;
  }
}

async function copyStudentCopy(plainText: string, html: string): Promise<void> {
  if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([plainText], { type: 'text/plain' }),
      }),
    ]);
    return;
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(plainText);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = plainText;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  if (!copied) {
    throw new Error('Unable to copy the adapted student version.');
  }
}

type DifferentiationAdapterResponseProps = {
  response: DifferentiationAdapterResponseData;
};

export default function DifferentiationAdapterResponse({
  response,
}: DifferentiationAdapterResponseProps) {
  const localize = useLocalize();
  const [copied, setCopied] = useState(false);
  const { adaptedStudentCopy, comparisonRows, download, learningObjective, teacherReviewFlags } =
    response;
  const plainText = useMemo(
    () => getCompleteAdaptedStudentPlainText(adaptedStudentCopy),
    [adaptedStudentCopy],
  );
  const studentHtml = useMemo(() => {
    const sourceHtml = createStudentCopyHtml(adaptedStudentCopy);
    const htmlWithTitle = containsTitle(sourceHtml, adaptedStudentCopy.title)
      ? sourceHtml
      : `<h1>${escapeStudentCopyHtml(adaptedStudentCopy.title)}</h1>${sourceHtml}`;
    return DOMPurify.sanitize(htmlWithTitle, {
      ALLOWED_ATTR: allowedAttributes,
      ALLOWED_TAGS: allowedTags,
    });
  }, [adaptedStudentCopy]);
  const downloadUrl = useMemo(
    () => (download ? getSafeDownloadUrl(download.url) : null),
    [download],
  );

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timeoutId = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timeoutId);
  }, [copied]);

  const handleCopy = async () => {
    try {
      await copyStudentCopy(plainText, studentHtml);
      setCopied(true);
    } catch (error) {
      console.error('Failed to copy adapted student version:', error);
    }
  };

  return (
    <article className="not-prose my-5 space-y-5 text-left font-sans text-text-primary">
      <section
        aria-label={localize('com_ui_differentiation_adapter_teacher_review')}
        className="overflow-hidden rounded-xl border border-border-light bg-surface-secondary"
      >
        <div className="border-b border-border-light px-4 py-3 sm:px-5">
          <h2 className="text-base font-semibold text-text-primary">
            {localize('com_ui_differentiation_adapter_teacher_review')}
          </h2>
          {learningObjective ? (
            <p className="mt-1 text-sm leading-6 text-text-secondary">
              <span className="font-medium text-text-primary">
                {localize('com_ui_differentiation_adapter_learning_objective')}:
              </span>{' '}
              {learningObjective}
            </p>
          ) : null}
        </div>
        {comparisonRows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[42rem] border-collapse text-sm leading-6">
              <thead className="bg-surface-primary text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">
                <tr>
                  <th className="border-b border-border-light px-4 py-2.5 sm:px-5">
                    {localize('com_ui_differentiation_adapter_original')}
                  </th>
                  <th className="border-b border-border-light px-4 py-2.5 sm:px-5">
                    {localize('com_ui_differentiation_adapter_adapted')}
                  </th>
                  <th className="border-b border-border-light px-4 py-2.5 sm:px-5">
                    {localize('com_ui_differentiation_adapter_change')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row, index) => (
                  <tr key={`${row.change}-${index}`} className="align-top">
                    <td className="border-b border-border-light px-4 py-3 text-text-secondary sm:px-5">
                      {row.original}
                    </td>
                    <td className="border-b border-border-light px-4 py-3 text-text-primary sm:px-5">
                      {row.adapted}
                    </td>
                    <td className="border-b border-border-light px-4 py-3 text-text-secondary sm:px-5">
                      {row.change}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {teacherReviewFlags.length > 0 ? (
          <ul className="space-y-1 border-t border-border-light px-4 py-3 text-sm leading-6 text-text-secondary sm:px-5">
            {teacherReviewFlags.map((flag) => (
              <li key={flag} className="flex gap-2">
                <span aria-hidden="true">•</span>
                <span>{flag}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section
        aria-label={localize('com_ui_differentiation_adapter_student_copy')}
        className="overflow-hidden rounded-xl border border-border-medium bg-surface-primary shadow-sm"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border-light bg-surface-secondary px-4 py-3 sm:px-5">
          <h2 className="text-base font-semibold text-text-primary">
            {localize('com_ui_differentiation_adapter_student_copy')}
          </h2>
          <button
            type="button"
            onClick={() => void handleCopy()}
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-border-medium bg-surface-primary px-3 text-sm font-medium text-text-primary transition-colors hover:bg-surface-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={localize('com_ui_differentiation_adapter_copy')}
          >
            {copied ? (
              <Check className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Copy className="h-4 w-4" aria-hidden="true" />
            )}
            {copied
              ? localize('com_ui_differentiation_adapter_copied')
              : localize('com_ui_differentiation_adapter_copy')}
          </button>
        </div>
        <div className="max-h-[38rem] select-text overflow-auto px-5 py-6 sm:px-7">
          <div
            className="student-copy-content text-[0.95rem] leading-7 text-text-primary [&_a]:text-blue-700 [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-border-medium [&_blockquote]:pl-4 [&_h1]:mb-4 [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:mb-3 [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:mt-5 [&_h3]:text-lg [&_h3]:font-semibold [&_li]:my-1 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-4 [&_table]:my-5 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-border-light [&_td]:p-2 [&_th]:border [&_th]:border-border-light [&_th]:bg-surface-secondary [&_th]:p-2 [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6"
            dangerouslySetInnerHTML={{ __html: studentHtml }}
          />
        </div>
      </section>

      {download && downloadUrl ? (
        <a
          href={downloadUrl}
          download={download.filename}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 text-sm font-medium text-blue-700 underline underline-offset-4 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          {localize('com_ui_differentiation_adapter_download', { 0: download.filename })}
        </a>
      ) : null}
    </article>
  );
}
