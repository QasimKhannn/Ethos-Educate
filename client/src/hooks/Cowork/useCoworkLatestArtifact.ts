// cowork — Phase A / A1. Parse the most recent COMPLETE artifact block out of the
// latest assistant message in a Cowork run, so the Preview tab can render it live.
//
// This is read-only and self-contained: it does NOT touch the main chat's Recoil
// artifact state (store.artifactsState) or the global Artifacts panel. Cowork uses
// MarkdownLite (no artifactPlugin), so the raw `:::artifact{…}:::` markup stays in the
// assistant message text — we parse it here.
//
// Format emitted by the agent (see packages/api/src/prompts/artifacts/index.ts):
//
//   :::artifact{identifier="id" type="mime-type" title="Title"}
//   ```lang
//   <content>
//   ```
//   :::
import { useMemo } from 'react';
import type { Artifact } from '~/common';
import type { CoworkMessage } from '~/components/Cowork/useCoworkChat';

// A complete block with fenced content (the normal case).
const FENCED = /:::artifact\{([^}]*)\}\s*```([^\n]*)\n([\s\S]*?)```\s*:::/;
// Fallback: a complete block whose content is not fenced (rare).
const UNFENCED = /:::artifact\{([^}]*)\}\s*([\s\S]*?):::/;

function parseAttrs(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /(\w+)="([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) != null) {
    attrs[m[1]] = m[2];
  }
  return attrs;
}

/**
 * Remove artifact blocks from assistant text for CHAT DISPLAY only (Cowork uses
 * MarkdownLite, which has no artifact plugin, so the raw `:::artifact{…}:::` markup
 * and its code fence would otherwise show as literal text). Also strips a dangling,
 * still-streaming opener so half-written markup never flashes in the transcript.
 * This does NOT affect parsing — the Preview tab parses from the untouched message text.
 */
export function stripArtifactBlocks(text: string): { hadArtifact: boolean; rest: string } {
  if (!text || text.indexOf(':::artifact') === -1) {
    return { hadArtifact: false, rest: text };
  }
  let had = false;
  let rest = text.replace(new RegExp(FENCED.source, 'g'), () => {
    had = true;
    return '';
  });
  rest = rest.replace(new RegExp(UNFENCED.source, 'g'), () => {
    had = true;
    return '';
  });
  // A dangling opener (no closing ::: yet) — hide it while it streams.
  const openIdx = rest.indexOf(':::artifact');
  if (openIdx !== -1) {
    had = true;
    rest = rest.slice(0, openIdx);
  }
  return { hadArtifact: had, rest: rest.trim() };
}

/**
 * Returns the latest complete artifact from the current run, or null when there
 * is none yet (e.g. the closing `:::` hasn't streamed in — we intentionally wait
 * for a complete block so the preview doesn't flicker mid-stream).
 */
/** Parse the last artifact block out of a single message's text, or null. */
function parseArtifactFromText(text: string, messageId: string): Artifact | null {
  if (!text || text.indexOf(':::artifact') === -1) {
    return null;
  }

  // Prefer the LAST fenced artifact block in the message (an agent may emit more
  // than one; the newest is what the user just asked to see).
  let last: RegExpExecArray | null = null;
  const globalFenced = new RegExp(FENCED.source, 'g');
  let match: RegExpExecArray | null;
  while ((match = globalFenced.exec(text)) != null) {
    last = match;
  }

  let attrsRaw = '';
  let content = '';

  if (last) {
    attrsRaw = last[1] ?? '';
    // NOTE: group 2 is the code-fence info string (e.g. "jsx"). We deliberately do
    // NOT use it as the artifact `language`: getKey() concatenates type + language,
    // and a compound key like "application/vnd.react-jsx" isn't in the template map,
    // so getTemplate() would fall back to "static" and render React source as plain
    // HTML. The MIME `type` alone drives template selection.
    content = last[3] ?? '';
  } else {
    const nf = UNFENCED.exec(text);
    if (!nf) {
      return null;
    }
    attrsRaw = nf[1] ?? '';
    content = (nf[2] ?? '').trim();
  }

  if (!content.trim()) {
    return null;
  }

  const attrs = parseAttrs(attrsRaw);
  const identifier = attrs.identifier || 'cowork-artifact';

  return {
    id: `cowork-${messageId}-${identifier}`,
    identifier,
    type: attrs.type || 'text/html',
    title: attrs.title || 'Preview',
    // language intentionally omitted — see note above; type drives template.
    content,
    lastUpdateTime: Date.now(),
    messageId,
  } as Artifact;
}

export function useCoworkLatestArtifact(messages: CoworkMessage[]): Artifact | null {
  return useMemo(() => {
    // Scan newest → oldest and return the most recent assistant message that
    // actually contains an artifact. This makes the preview PERSIST across later
    // messages that don't produce one (the earlier fix only looked at the single
    // latest reply, so any follow-up message with no artifact hid the preview).
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role !== 'assistant' || typeof m.text !== 'string' || m.text.length === 0) {
        continue;
      }
      const artifact = parseArtifactFromText(m.text, m.id);
      if (artifact) {
        return artifact;
      }
    }
    return null;
  }, [messages]);
}
