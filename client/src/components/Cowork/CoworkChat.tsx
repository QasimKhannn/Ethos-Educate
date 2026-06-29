// cowork — lightweight chat UI for a Cowork project (uses useCoworkChat).
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
  type UIEvent,
} from 'react';
import { useRecoilValue } from 'recoil';
import { Feather, ArrowUp, Loader2, Code2, Globe, Wrench, Square, Pencil, Paperclip } from 'lucide-react';
import { FileUpload, TooltipAnchor, AttachmentIcon } from '@librechat/client';
import { EModelEndpoint, Constants, dataService } from 'librechat-data-provider';
import type { TConversation } from 'librechat-data-provider';
import type { ExtendedFile } from '~/common';
import {
  useCoworkChat,
  COWORK_AGENT_ID,
  type CoworkTraceEntry,
  type CoworkMode,
  type CoworkFile,
} from './useCoworkChat';
import { TraceRow } from './CoworkTracePanel';
import CoworkPlanCard from './CoworkPlanCard';
import CoworkEmailCard, { extractEmail } from './CoworkEmailCard';
import CoworkActionCard, { extractAction } from './CoworkActionCard';
import CoworkAudioRecorder from './CoworkAudioRecorder';
import FileRow from '~/components/Chat/Input/Files/FileRow';
import MarkdownLite from '~/components/Chat/Messages/Content/MarkdownLite';
import { useAttachmentLink } from '~/components/Chat/Messages/Content/Parts/LogLink';
import { useFileHandlingNoChatContext } from '~/hooks/Files/useFileHandling';
import { useAuthContext } from '~/hooks/AuthContext';
import { useLocalize } from '~/hooks';
import store from '~/store';

// A clickable file chip that downloads non-image attachments through the authenticated
// /api/files/download endpoint (the raw filepath 404s for local/blob-stored docs).
function CoworkFileChip({ file, userId }: { file: CoworkFile; userId?: string }) {
  const { handleDownload } = useAttachmentLink({
    href: file.filepath ?? '',
    filename: file.filename ?? 'file',
    file_id: file.file_id,
    user: userId,
    source: file.source,
  });
  return (
    <a
      href={file.filepath ?? '#'}
      onClick={handleDownload}
      target="_blank"
      rel="noreferrer"
      title={file.filename ?? 'Open file'}
      className="flex items-center gap-1.5 rounded-lg border border-border-medium bg-surface-secondary px-2.5 py-1.5 text-xs text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
    >
      <Paperclip className="size-3.5 flex-none" />
      <span className="max-w-[10rem] truncate">{file.filename ?? 'Attachment'}</span>
    </a>
  );
}

// An image attachment. The raw filepath isn't directly navigable (it falls through to
// the SPA 404, and on the deployed non-public blob store it isn't fetchable at all), so
// we pull the bytes through the authenticated download endpoint into a blob URL and use
// that for BOTH the inline thumbnail and the click-to-open-in-new-tab target.
function CoworkImageAttachment({ file, userId }: { file: CoworkFile; userId?: string }) {
  const [blobUrl, setBlobUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!file.file_id || !userId) {
      return;
    }
    let active = true;
    let created: string | undefined;
    dataService
      .getFileDownload(userId, file.file_id)
      .then((res) => {
        if (!active) {
          return;
        }
        // The download endpoint serves bytes as a generic attachment, so re-wrap the
        // blob with the real image MIME type — otherwise the browser downloads it as a
        // file instead of rendering it inline.
        const data = res.data as Blob;
        const typed = new Blob([data], { type: file.type || data.type || 'image/png' });
        created = window.URL.createObjectURL(typed);
        setBlobUrl(created);
      })
      .catch(() => {
        /* fall back to the raw filepath below */
      });
    return () => {
      active = false;
      if (created) {
        window.URL.revokeObjectURL(created);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file.file_id, userId, file.type]);

  const src = blobUrl ?? file.filepath;
  return (
    <a href={src} target="_blank" rel="noreferrer" title={file.filename ?? 'Open image'}>
      <img
        src={src}
        alt={file.filename ?? 'image'}
        className="max-h-44 max-w-[12rem] cursor-pointer rounded-xl border border-border-light object-cover transition-opacity hover:opacity-90"
      />
    </a>
  );
}

const MODES: { id: CoworkMode; label: string; hint: string }[] = [
  { id: 'ask', label: 'Ask', hint: 'Answer questions — never changes files' },
  { id: 'plan', label: 'Plan', hint: 'Draft a plan — never changes files' },
  { id: 'agent', label: 'Agent', hint: 'Do the work — reads and writes files' },
];

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
  const localize = useLocalize();
  const { user } = useAuthContext();
  const speechEnabled = useRecoilValue(store.speechToText);
  // Image / file attachments for the next message — Cowork-local state (isolated
  // from the normal chat's Recoil file store). Uploaded via the standard files API
  // through the no-ChatContext variant of useFileHandling.
  const [files, setFiles] = useState<Map<string, ExtendedFile>>(new Map());
  const [filesLoading, setFilesLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { handleFileChange, handleFiles, abortUpload } = useFileHandlingNoChatContext(
    { endpointOverride: EModelEndpoint.agents },
    {
      files,
      setFiles,
      setFilesLoading,
      conversation: {
        conversationId: Constants.NEW_CONVO,
        endpoint: EModelEndpoint.agents,
        agent_id: COWORK_AGENT_ID,
      } as unknown as TConversation,
    },
  );
  const [mode, setMode] = useState<CoworkMode>('agent');
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
    // Only fully-uploaded files (progress === 1, has a server file_id) are sent.
    const uploaded: CoworkFile[] = Array.from(files.values())
      .filter((f) => f.progress === 1 && f.file_id)
      .map((f) => ({
        file_id: f.file_id,
        filepath: f.filepath,
        filename: f.filename,
        source: f.source,
        type: f.type,
        height: f.height,
        width: f.width,
      }));
    if ((!text && uploaded.length === 0) || isStreaming || filesLoading) {
      return;
    }
    send(text, mode, uploaded);
    setInput('');
    setFiles(new Map());
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

  /** Paste images straight from the clipboard (e.g. a screenshot) into the message. */
  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = e.clipboardData?.files;
    if (!pasted || pasted.length === 0) {
      return;
    }
    const images = Array.from(pasted).filter((f) => f.type.startsWith('image/'));
    if (images.length > 0) {
      e.preventDefault();
      handleFiles(images);
    }
  };

  /** Drag-and-drop files onto the input bar. */
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    const dropped = e.dataTransfer?.files;
    if (dropped && dropped.length > 0) {
      e.preventDefault();
      handleFiles(Array.from(dropped));
    }
  };

  /** Approve a plan: flip to Agent mode and execute it. */
  const approvePlan = () => {
    if (isStreaming) {
      return;
    }
    setMode('agent');
    send('Execute the approved plan above.', 'agent');
  };

  /** Approve a previewed connector write action: tell the agent to perform it now. */
  const approveAction = () => {
    if (isStreaming) {
      return;
    }
    setMode('agent');
    send('Approved — perform the action you previewed above.', 'agent');
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
                        ref={(el) => {
                          // Place the caret at the end ONCE when the edit box opens. Doing this on
                          // every render (the old behavior) yanked the cursor to the end after each
                          // keystroke, making mid-message edits impossible. The dataset flag persists
                          // on the (reused) DOM node, so it only runs the first time.
                          if (el && !el.dataset.caretInit) {
                            el.dataset.caretInit = '1';
                            el.selectionStart = el.selectionEnd = el.value.length;
                          }
                        }}
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
                              send(t, mode);
                            }
                            setEditingId(null);
                            setEditText('');
                          }}
                          className="rounded-md bg-blue-600 px-3 py-1.5 text-xs text-white hover:opacity-90 disabled:opacity-50"
                          disabled={!editText.trim() || isStreaming}
                        >
                          Send
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div key={m.id} className="group flex justify-end">
                      <div className="relative max-w-[80%]">
                        {/* Attached images / files shown in the user's own bubble */}
                        {m.files && m.files.length > 0 && (
                          <div className="mb-1.5 flex flex-wrap justify-end gap-1.5">
                            {m.files.map((f, i) =>
                              f.type?.startsWith('image') ? (
                                <CoworkImageAttachment
                                  key={f.file_id ?? i}
                                  file={f}
                                  userId={user?.id}
                                />
                              ) : (
                                // Non-image files download via the authenticated endpoint.
                                <CoworkFileChip key={f.file_id ?? i} file={f} userId={user?.id} />
                              ),
                            )}
                          </div>
                        )}
                        {m.text && (
                          <div className="whitespace-pre-wrap rounded-2xl bg-surface-tertiary px-4 py-2.5 text-sm text-text-primary">
                            {m.text}
                          </div>
                        )}
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
                      {m.mode === 'plan' && m.text ? (
                        <CoworkPlanCard
                          content={m.text}
                          isStreaming={isStreaming && m.id === lastId}
                          onApprove={approvePlan}
                        />
                      ) : (
                        (() => {
                          const { email, rest: afterEmail } = extractEmail(m.text);
                          const { action, rest } = extractAction(afterEmail);
                          return (
                            <>
                              {rest && (
                                <div className="prose prose-sm dark:prose-invert max-w-none">
                                  <MarkdownLite content={rest} />
                                </div>
                              )}
                              {email && (
                                <div className={rest ? 'mt-3' : ''}>
                                  <CoworkEmailCard email={email} />
                                </div>
                              )}
                              {action && (
                                <div className={rest || email ? 'mt-3' : ''}>
                                  <CoworkActionCard
                                    action={action}
                                    onApprove={
                                      m.id === lastId && !isStreaming ? approveAction : undefined
                                    }
                                    isBusy={isStreaming}
                                  />
                                </div>
                              )}
                            </>
                          );
                        })()
                      )}
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
            {/* Mode toggle — Ask / Plan / Agent (applies to the next message) */}
            <div className="mb-2 inline-flex rounded-lg border border-border-medium bg-surface-secondary p-0.5 text-xs">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMode(m.id)}
                  title={m.hint}
                  className={`rounded-md px-2.5 py-1 transition-colors ${
                    mode === m.id
                      ? 'bg-surface-primary font-medium text-text-primary shadow-sm'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <div
              className="rounded-2xl border border-border-medium bg-surface-primary px-3 py-2.5 shadow-sm"
              onDrop={onDrop}
              onDragOver={(e) => e.preventDefault()}
            >
              {/* Attached image / file thumbnails (reuses the normal chat's FileRow) */}
              {files.size > 0 && (
                <div className="mb-2 px-1">
                  <FileRow
                    files={files}
                    setFiles={setFiles}
                    abortUpload={abortUpload}
                    setFilesLoading={setFilesLoading}
                    agent_id={COWORK_AGENT_ID}
                  />
                </div>
              )}
              <div className="relative flex items-end gap-1.5">
                {/* Attach image / file */}
                <FileUpload ref={fileInputRef} handleFileChange={handleFileChange}>
                  <TooltipAnchor
                    description={localize('com_sidepanel_attach_files')}
                    render={
                      <button
                        type="button"
                        aria-label={localize('com_sidepanel_attach_files')}
                        disabled={isStreaming}
                        onClick={() => {
                          if (fileInputRef.current) {
                            fileInputRef.current.value = '';
                            fileInputRef.current.click();
                          }
                        }}
                        className="flex size-9 flex-none items-center justify-center rounded-full p-1 transition-colors hover:bg-surface-hover disabled:opacity-40"
                        title="Attach image or file"
                      >
                        <AttachmentIcon />
                      </button>
                    }
                  />
                </FileUpload>
                <textarea
                  ref={textareaRef}
                  rows={1}
                  value={input}
                  onChange={(e) => { setInput(e.target.value); resizeTextarea(); }}
                  onKeyDown={onKeyDown}
                  onPaste={onPaste}
                  placeholder="Message Cowork agent… (Shift+Enter for new line)"
                  readOnly={isStreaming}
                  className="w-full resize-none bg-transparent py-1.5 text-sm leading-relaxed text-text-primary outline-none focus:outline-none focus:ring-0 placeholder:text-text-tertiary"
                  style={{ overflow: 'hidden' }}
                />
                {speechEnabled && (
                  <CoworkAudioRecorder
                    disabled={isStreaming}
                    value={input}
                    onChange={(t) => {
                      setInput(t);
                      requestAnimationFrame(resizeTextarea);
                    }}
                  />
                )}
                {isStreaming ? (
                  <button
                    type="button"
                    onClick={stop}
                    className="mb-0.5 flex-none rounded-full bg-blue-600 p-1.5 text-white transition-opacity hover:opacity-80"
                    title="Stop generation"
                  >
                    <Square className="size-3.5 fill-current" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={submit}
                    disabled={(!input.trim() && files.size === 0) || filesLoading}
                    className="mb-0.5 flex-none rounded-full bg-blue-600 p-1.5 text-white transition-opacity hover:opacity-90 disabled:opacity-30"
                    title="Send (Enter)"
                  >
                    <ArrowUp className="size-4" />
                  </button>
                )}
              </div>
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
