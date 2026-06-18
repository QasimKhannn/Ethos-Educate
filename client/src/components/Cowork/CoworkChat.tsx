// cowork — lightweight chat UI for a Cowork project (uses useCoworkChat).
import { useLayoutEffect, useRef, type KeyboardEvent, type UIEvent } from 'react';
import { Feather, ArrowUp, Loader2, Code2, Globe, Wrench, Square, Pencil } from 'lucide-react';
import { useCoworkChat, type CoworkTraceEntry } from './useCoworkChat';
import { TraceRow } from './CoworkTracePanel';
import MarkdownLite from '~/components/Chat/Messages/Content/MarkdownLite';
import { useState } from 'react';

// ---------------------------------------------------------------------------
// Live status — shown inline while the agent is working, before text appears.
// ---------------------------------------------------------------------------

function toolLabel(name: string): { label: string; Icon: typeof Wrench } {
  switch (name) {
    case 'execute_code':
      return { label: 'Running code', Icon: Code2 };
    case 'tavily_search_results_json':
    case 'web_search':
      return { label: 'Searching the web', Icon: Globe };
    default:
      return { label: name.replace(/_/g, ' '), Icon: Wrench };
  }
}

function LiveStatus({ trace, isStreaming, hasText }: {
  trace: CoworkTraceEntry[];
  isStreaming: boolean;
  hasText: boolean;
}) {
  if (!isStreaming) {
    return null;
  }

  // Agent is writing the text response — no status pill needed, text is the indicator.
  if (hasText) {
    return null;
  }

  // A tool is currently running — show which one.
  const running = trace.find((e) => e.status === 'running');
  if (running) {
    const { label, Icon } = toolLabel(running.name);
    return (
      <div className="mb-2 flex items-center gap-2 text-sm text-text-secondary">
        <Icon className="size-4 shrink-0 animate-pulse text-text-info" />
        <span>{label}…</span>
      </div>
    );
  }

  // All tool steps done but still streaming (agent composing response between steps).
  if (trace.length > 0) {
    return (
      <div className="mb-2 flex items-center gap-2 text-sm text-text-secondary">
        <Loader2 className="size-4 shrink-0 animate-spin" />
        <span>Analysing results…</span>
      </div>
    );
  }

  // Nothing yet — pure "thinking" state.
  return (
    <div className="mb-2 flex items-center gap-2 text-sm text-text-secondary">
      <span className="flex gap-0.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-1.5 rounded-full bg-text-tertiary"
            style={{ animation: `cowork-bounce 1.2s ease-in-out ${i * 0.2}s infinite` }}
          />
        ))}
      </span>
      <span>Thinking…</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function CoworkChat({
  projectId,
  initialConversationId,
  onTraceChange,
  model,
  provider,
  onSessionStart,
}: {
  projectId: string;
  initialConversationId?: string;
  onTraceChange?: (trace: CoworkTraceEntry[]) => void;
  model?: string;
  provider?: string;
  onSessionStart?: () => void;
}) {
  const { messages, isStreaming, error, send, stop, removeFrom, loadOlder, hasMore, isLoadingOlder, trace } =
    useCoworkChat(projectId, initialConversationId, onTraceChange, model, provider, onSessionStart);
  const [input, setInput] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const lastId = messages[messages.length - 1]?.id;
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const restoreRef = useRef<{ height: number; top: number } | null>(null);

  /** Grow/shrink the textarea to fit its content. */
  const resizeTextarea = () => {
    const el = textareaRef.current;
    if (!el) {
      return;
    }
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 208)}px`; // 208px ≈ max-h-52
  };

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) {
      return;
    }
    if (restoreRef.current) {
      el.scrollTop = el.scrollHeight - restoreRef.current.height + restoreRef.current.top;
      restoreRef.current = null;
    } else {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  const onScroll = (e: UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (isLoadingOlder || !hasMore) {
      return;
    }
    if (el.scrollTop <= 64) {
      restoreRef.current = { height: el.scrollHeight, top: el.scrollTop };
      loadOlder();
    }
  };

  const submit = () => {
    const text = input.trim();
    if (!text || isStreaming) {
      return;
    }
    send(text);
    setInput('');
    // Reset height after clearing.
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <>
      {/* Bounce keyframe — injected once as a style tag, avoids a CSS file dependency */}
      <style>{`
        @keyframes cowork-bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>

      <div className="flex h-full flex-col">
        {/* ── message list ── */}
        <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto px-4 py-6">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-text-secondary">
              <Feather className="size-8 text-text-info" />
              <div>
                <p className="text-sm font-medium text-text-primary">Give the Cowork agent a goal.</p>
                <p className="mt-1 text-xs text-text-tertiary">
                  It can read your workspace files and write deliverables back.
                </p>
              </div>
            </div>
          ) : (
            <div className="mx-auto flex max-w-2xl flex-col gap-8">
              {(isLoadingOlder || hasMore) && (
                <div className="flex justify-center py-1 text-text-tertiary">
                  {isLoadingOlder ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <span className="text-xs">Scroll up for earlier messages</span>
                  )}
                </div>
              )}

              {messages.map((m) =>
                m.role === 'user' ? (
                  // User bubble — right-aligned, surface-tertiary background.
                  editingId === m.id ? (
                    // Full-width inline edit form (breaks out of bubble constraints)
                    <div key={m.id} className="flex flex-col gap-2">
                      <textarea
                        autoFocus
                        value={editText}
                        ref={(el) => { if (el) { el.selectionStart = el.selectionEnd = el.value.length; } }}
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') { setEditingId(null); setEditText(''); }
                        }}
                        rows={4}
                        className="w-full resize-none rounded-xl border border-border-heavy bg-surface-secondary px-4 py-3 text-sm leading-relaxed text-text-primary outline-none focus:outline-none focus:ring-0"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => { setEditingId(null); setEditText(''); }}
                          className="rounded-md px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const t = editText.trim();
                            if (t && editingId) {
                              removeFrom(editingId);
                              send(t);
                            }
                            setEditingId(null);
                            setEditText('');
                          }}
                          className="rounded-md bg-text-info px-3 py-1.5 text-xs text-white hover:opacity-90 disabled:opacity-50"
                          disabled={!editText.trim() || isStreaming}
                        >
                          Send
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div key={m.id} className="group flex justify-end">
                      <div className="relative max-w-[80%]">
                        <div className="whitespace-pre-wrap rounded-2xl bg-surface-tertiary px-4 py-2.5 text-sm text-text-primary">
                          {m.text}
                        </div>
                        <button
                          type="button"
                          title="Edit message"
                          onClick={() => { setEditingId(m.id); setEditText(m.text); }}
                          className="absolute -left-7 top-2 hidden rounded p-1 text-text-tertiary hover:text-text-secondary group-hover:block"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  )
                ) : (
                  // Agent reply — left-aligned, icon + prose.
                  <div key={m.id} className="flex gap-3">
                    <div className="mt-0.5 flex size-6 flex-none items-center justify-center rounded-full bg-surface-tertiary">
                      <Feather className="size-3.5 text-text-info" />
                    </div>
                    <div className="min-w-0 flex-1 pt-0.5">
                      {/* Inline trace rows for the current run */}
                      {m.id === lastId && trace.length > 0 && (
                        <div className="mb-3 flex flex-col gap-1.5">
                          {trace.map((entry) => (
                            <TraceRow key={entry.id} entry={entry} />
                          ))}
                        </div>
                      )}
                      {/* Live status pill (thinking / running tool / analysing) */}
                      {m.id === lastId && (
                        <LiveStatus
                          trace={trace}
                          isStreaming={isStreaming}
                          hasText={m.text.length > 0}
                        />
                      )}
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <MarkdownLite content={m.text} />
                      </div>
                    </div>
                  </div>
                ),
              )}
              {error && (
                <p className="rounded-md bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</p>
              )}
            </div>
          )}
        </div>

        {/* ── input bar ── */}
        <div className="px-4 pb-5 pt-2">
          <div className="mx-auto max-w-2xl">
            <div className="relative flex items-end gap-2 rounded-2xl border border-border-medium bg-surface-primary px-4 py-3 shadow-sm">
              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={(e) => { setInput(e.target.value); resizeTextarea(); }}
                onKeyDown={onKeyDown}
                placeholder="Message Cowork agent… (Shift+Enter for new line)"
                readOnly={isStreaming}
                className="w-full resize-none bg-transparent text-sm leading-relaxed text-text-primary outline-none focus:outline-none focus:ring-0 placeholder:text-text-tertiary"
                style={{ overflow: 'hidden' }}
              />
              {isStreaming ? (
                <button
                  type="button"
                  onClick={stop}
                  className="mb-0.5 flex-none rounded-full bg-text-info p-1.5 text-white transition-opacity hover:opacity-80"
                  title="Stop generation"
                >
                  <Square className="size-3.5 fill-current" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={submit}
                  disabled={!input.trim()}
                  className="mb-0.5 flex-none rounded-full bg-text-info p-1.5 text-white transition-opacity hover:opacity-90 disabled:opacity-30"
                  title="Send (Enter)"
                >
                  <ArrowUp className="size-4" />
                </button>
              )}
            </div>
            <p className="mt-1.5 text-center text-[11px] text-text-tertiary">
              Enter to send · Shift+Enter for new line
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
