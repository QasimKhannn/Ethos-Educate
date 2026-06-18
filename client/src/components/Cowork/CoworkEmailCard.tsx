// cowork — renders an agent-drafted email as a card with an "Open in Gmail" button that
// pre-fills a Gmail compose window (the user reviews and clicks Send). Text only; no API/OAuth.
import { Mail, ExternalLink } from 'lucide-react';

export type ParsedEmail = {
  to?: string;
  cc?: string;
  bcc?: string;
  subject?: string;
  body: string;
};

/**
 * Pull the first ```email fenced block out of an assistant message.
 * Headers (to/cc/bcc/subject) come first, then a blank line, then the body.
 * Returns the parsed email (or null) and the message text with the block removed.
 */
export function extractEmail(text: string): { email: ParsedEmail | null; rest: string } {
  const match = text.match(/```email[ \t]*\r?\n([\s\S]*?)```/i);
  if (!match) {
    return { email: null, rest: text };
  }
  const lines = match[1].split('\n');
  const email: ParsedEmail = { body: '' };
  let i = 0;
  for (; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '') {
      i++;
      break; // blank line ends the headers
    }
    const header = line.match(/^(to|cc|bcc|subject)[ \t]*:[ \t]*(.*)$/i);
    if (!header) {
      break; // first non-header line starts the body
    }
    const key = header[1].toLowerCase() as 'to' | 'cc' | 'bcc' | 'subject';
    email[key] = header[2].trim();
  }
  email.body = lines.slice(i).join('\n').trim();

  const start = match.index ?? 0;
  const rest = (text.slice(0, start) + text.slice(start + match[0].length)).trim();
  return { email, rest };
}

function buildGmailComposeUrl(email: ParsedEmail): string {
  const url = new URL('https://mail.google.com/mail/');
  url.searchParams.set('view', 'cm');
  url.searchParams.set('fs', '1');
  if (email.to) {
    url.searchParams.set('to', email.to);
  }
  if (email.cc) {
    url.searchParams.set('cc', email.cc);
  }
  if (email.bcc) {
    url.searchParams.set('bcc', email.bcc);
  }
  if (email.subject) {
    url.searchParams.set('su', email.subject);
  }
  if (email.body) {
    url.searchParams.set('body', email.body);
  }
  return url.toString();
}

function Row({ label, value }: { label: string; value?: string }) {
  if (!value) {
    return null;
  }
  return (
    <div className="flex gap-2 text-xs">
      <span className="w-12 flex-none text-text-tertiary">{label}</span>
      <span className="min-w-0 flex-1 break-words text-text-primary">{value}</span>
    </div>
  );
}

export default function CoworkEmailCard({ email }: { email: ParsedEmail }) {
  const open = () => {
    window.open(buildGmailComposeUrl(email), '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border-medium bg-surface-primary shadow-sm">
      <div className="flex items-center gap-2 border-b border-border-medium bg-surface-secondary/50 px-3 py-2">
        <Mail className="size-4 text-text-info" />
        <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
          Email draft
        </span>
        <span className="ml-auto text-[11px] text-text-tertiary">you review &amp; send in Gmail</span>
      </div>

      <div className="flex flex-col gap-1.5 px-4 py-3">
        <Row label="To" value={email.to} />
        <Row label="Cc" value={email.cc} />
        <Row label="Bcc" value={email.bcc} />
        <Row label="Subject" value={email.subject} />
        <div className="mt-1 whitespace-pre-wrap break-words border-t border-border-medium pt-2 text-sm text-text-primary">
          {email.body}
        </div>
      </div>

      <div className="flex items-center justify-end border-t border-border-medium px-3 py-2">
        <button
          type="button"
          onClick={open}
          className="flex items-center gap-1.5 rounded-md bg-text-info px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
          title="Open a pre-filled Gmail compose window"
        >
          <ExternalLink className="size-3.5" />
          Open in Gmail
        </button>
      </div>
    </div>
  );
}
