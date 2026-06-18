// cowork — self-contained chat against the Cowork agent.
//
// Deliberately does NOT reuse ChatView or the global chat hooks: it owns its own
// message state and SSE stream, so it cannot navigate away or touch the normal
// chat's state. It speaks the same wire protocol (createPayload + sse.js) the
// normal chat uses, and links the conversation to the Cowork project on creation.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { SSE } from 'sse.js';
import { useQueryClient } from '@tanstack/react-query';
import {
  Constants,
  ContentTypes,
  EModelEndpoint,
  QueryKeys,
  dataService,
  createPayload,
  removeNullishValues,
  request,
  apiBaseUrl,
} from 'librechat-data-provider';
import { useAuthContext } from '~/hooks/AuthContext';
import { abortStream } from '~/data-provider/SSE/mutations';

export const COWORK_AGENT_ID = 'agent_cowork_default';

/** Join the text parts of an agent response's content array. */
function extractContentText(content?: Array<Record<string, unknown>>): string {
  if (!Array.isArray(content)) {
    return '';
  }
  return content
    .filter((p) => p.type === 'text')
    .map((p) => {
      const t = p.text as { value?: string } | string | undefined;
      return typeof t === 'string' ? t : (t?.value ?? '');
    })
    .join('');
}

export type CoworkMode = 'ask' | 'plan' | 'agent';

export type CoworkMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  /** Mode the message was produced in (used to render plan-mode replies as a Plan card). */
  mode?: CoworkMode;
};

const MESSAGES_PAGE = 25;

type CoworkMessageDoc = {
  messageId: string;
  isCreatedByUser: boolean;
  text: string;
  content?: Array<Record<string, unknown>>;
};

/** Map a stored message doc to a display message. */
function mapDoc(m: CoworkMessageDoc): CoworkMessage {
  return {
    id: m.messageId,
    role: (m.isCreatedByUser ? 'user' : 'assistant') as 'user' | 'assistant',
    text: m.text || extractContentText(m.content),
  };
}

/** One step in the agent's trace (a tool call and, once finished, its output). */
export type CoworkTraceEntry = {
  /** Run-step id (stable across the start + completed events). */
  id: string;
  /** Tool name, e.g. execute_code / file_search / web_search. */
  name: string;
  /** Short summary of the call arguments. */
  args?: string;
  /** Tool output, once the step completes. */
  output?: string;
  status: 'running' | 'done';
};

function truncate(value: unknown, n = 600): string | undefined {
  if (value == null) {
    return undefined;
  }
  const s = typeof value === 'string' ? value : JSON.stringify(value);
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

/** Translate agent run-step events into trace entries. */
function handleStepEvent(
  event: string,
  payload: unknown,
  setTrace: Dispatch<SetStateAction<CoworkTraceEntry[]>>,
): void {
  const p = payload as
    | {
        id?: string;
        stepDetails?: {
          type?: string;
          tool_calls?: Array<{ id?: string; name?: string; args?: unknown }>;
        };
        result?: { id?: string; tool_call?: { name?: string; args?: unknown; output?: string } };
      }
    | undefined;
  if (!p) {
    return;
  }

  if (event === 'on_run_step' && p.stepDetails?.type === 'tool_calls') {
    const stepId = p.id;
    const first = p.stepDetails.tool_calls?.[0];
    if (!stepId || !first) {
      return;
    }
    setTrace((prev) => {
      const idx = prev.findIndex((e) => e.id === stepId);
      const entry: CoworkTraceEntry = {
        id: stepId,
        name: first.name || 'tool',
        args: truncate(first.args),
        status: idx >= 0 && prev[idx].status === 'done' ? 'done' : 'running',
      };
      if (idx === -1) {
        return [...prev, entry];
      }
      const next = prev.slice();
      next[idx] = { ...next[idx], ...entry };
      return next;
    });
  } else if (event === 'on_run_step_completed') {
    const stepId = p.result?.id;
    const tc = p.result?.tool_call;
    if (!stepId) {
      return;
    }
    setTrace((prev) => {
      const idx = prev.findIndex((e) => e.id === stepId);
      if (idx === -1) {
        return [
          ...prev,
          {
            id: stepId,
            name: tc?.name || 'tool',
            args: truncate(tc?.args),
            output: truncate(tc?.output),
            status: 'done',
          },
        ];
      }
      const next = prev.slice();
      next[idx] = {
        ...next[idx],
        name: tc?.name || next[idx].name,
        output: truncate(tc?.output) ?? next[idx].output,
        status: 'done',
      };
      return next;
    });
  }
}

export function useCoworkChat(
  projectId: string,
  initialConversationId?: string,
  onTraceChange?: (trace: CoworkTraceEntry[]) => void,
  /** Override the agent's stored model (e.g. "gpt-5-nano"). Falls back to the seeded default. */
  model?: string,
  /** Override the agent's stored provider (e.g. "azureOpenAI"). Falls back to the seeded default. */
  provider?: string,
  /** Called once when this session becomes active (history loaded or first message sent). */
  onSessionStart?: () => void,
) {
  const { token } = useAuthContext();
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<CoworkMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [hasMore, setHasMore] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);

  // Agent step trace (tool calls + outputs) for the current run.
  const [trace, setTrace] = useState<CoworkTraceEntry[]>([]);
  useEffect(() => {
    onTraceChange?.(trace);
  }, [trace, onTraceChange]);

  const conversationIdRef = useRef<string | null>(null);
  const lastMessageIdRef = useRef<string>(Constants.NO_PARENT as string);
  const linkedRef = useRef(false);
  const oldestCursorRef = useRef<string | undefined>(undefined);
  const loadingOlderRef = useRef(false);
  // Stop-generation refs: current SSE connection + server-side stream id.
  const sseRef = useRef<SSE | null>(null);
  const streamIdRef = useRef<string | null>(null);

  // Restore the project's saved conversation on open — newest page only; older
  // messages page in on scroll-up (see loadOlder).
  const loadedRef = useRef(false);
  useEffect(() => {
    if (
      loadedRef.current ||
      !initialConversationId ||
      initialConversationId === Constants.NEW_CONVO
    ) {
      return;
    }
    loadedRef.current = true;
    conversationIdRef.current = initialConversationId;
    linkedRef.current = true;
    dataService
      .getCoworkConversationMessages(projectId, initialConversationId, { limit: MESSAGES_PAGE })
      .then((page) => {
        const mapped = page.messages.map(mapDoc).filter((m) => m.text.trim().length > 0);
        if (mapped.length > 0) {
          setMessages(mapped);
          onSessionStart?.();
        }
        oldestCursorRef.current = page.nextBefore;
        setHasMore(page.hasMore);
        // Thread new replies onto the newest stored message (incl. tool-only ones).
        const last = page.messages[page.messages.length - 1];
        if (last?.messageId) {
          lastMessageIdRef.current = last.messageId;
        }
      })
      .catch(() => {
        /* start fresh if history can't load */
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialConversationId, projectId]);

  /** Page in the previous block of older messages (prepended to the list). */
  const loadOlder = useCallback(() => {
    const cid = conversationIdRef.current;
    const before = oldestCursorRef.current;
    if (loadingOlderRef.current || !hasMore || !cid || !before) {
      return;
    }
    loadingOlderRef.current = true;
    setIsLoadingOlder(true);
    dataService
      .getCoworkConversationMessages(projectId, cid, { limit: MESSAGES_PAGE, before })
      .then((page) => {
        const mapped = page.messages.map(mapDoc).filter((m) => m.text.trim().length > 0);
        if (mapped.length > 0) {
          setMessages((prev) => [...mapped, ...prev]);
        }
        oldestCursorRef.current = page.nextBefore;
        setHasMore(page.hasMore);
      })
      .catch(() => {
        /* keep what we have */
      })
      .finally(() => {
        loadingOlderRef.current = false;
        setIsLoadingOlder(false);
      });
  }, [hasMore, projectId]);

  const setAssistantText = useCallback((assistantId: string, text: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === assistantId ? { ...m, text } : m)),
    );
  }, []);

  const adoptConversationId = useCallback(
    (cid?: string | null) => {
      if (!cid || cid === Constants.NEW_CONVO) {
        return;
      }
      conversationIdRef.current = cid;
      if (!linkedRef.current && projectId) {
        linkedRef.current = true;
        dataService.linkCoworkConversation(projectId, cid).catch(() => {
          linkedRef.current = false; // allow retry on next event
        });
      }
    },
    [projectId],
  );

  const send = useCallback(
    (text: string, mode: CoworkMode = 'agent') => {
      const trimmed = text.trim();
      if (!trimmed || isStreaming) {
        return;
      }
      setError(null);
      onSessionStart?.();

      const userId = uuidv4();
      const assistantId = uuidv4();
      setMessages((prev) => [
        ...prev,
        { id: userId, role: 'user', text: trimmed },
        { id: assistantId, role: 'assistant', text: '', mode },
      ]);
      setIsStreaming(true);
      setTrace([]); // fresh trace for this run

      const conversationId = conversationIdRef.current ?? (Constants.NEW_CONVO as string);
      const userMessage = {
        messageId: userId,
        conversationId,
        parentMessageId: lastMessageIdRef.current,
        text: trimmed,
        sender: 'User',
        isCreatedByUser: true,
        endpoint: EModelEndpoint.agents,
      };
      const submission = {
        userMessage,
        conversation: {
          conversationId,
          endpoint: EModelEndpoint.agents,
          agent_id: COWORK_AGENT_ID,
          ...(model ? { model } : {}),
        },
        endpointOption: {
          endpoint: EModelEndpoint.agents,
          agent_id: COWORK_AGENT_ID,
          coworkProjectId: projectId,
          coworkMode: mode,
          ...(model ? { model } : {}),
          ...(provider ? { provider } : {}),
        },
        isTemporary: false,
        isRegenerate: false,
        isContinued: false,
        isEdited: false,
        editedContent: null,
        ephemeralAgent: null,
      };

      let server: string;
      let payload: Record<string, unknown>;
      try {
        const built = createPayload(submission as Parameters<typeof createPayload>[0]);
        server = built.server;
        payload = removeNullishValues(built.payload) as Record<string, unknown>;
      } catch {
        setError('Could not prepare the request.');
        setIsStreaming(false);
        return;
      }

      // Resumable stream: POST starts generation (returns streamId + real
      // conversationId), then we subscribe to a separate GET SSE for the events.
      const subscribe = (streamId: string, authToken?: string) => {
        const streamUrl = `${apiBaseUrl()}/api/agents/chat/stream/${encodeURIComponent(streamId)}`;
        const sse = new SSE(streamUrl, {
          headers: { Authorization: `Bearer ${authToken ?? token}` },
          method: 'GET',
        });
        sseRef.current = sse;

        sse.addEventListener('message', (e: MessageEvent) => {
          let data: Record<string, unknown>;
          try {
            data = JSON.parse(e.data);
          } catch {
            return;
          }

          if (data.final != null) {
            const response = data.responseMessage as
              | { text?: string; content?: Array<Record<string, unknown>>; messageId?: string }
              | undefined;
            const finalText = response?.text || extractContentText(response?.content);
            if (finalText) {
              setAssistantText(assistantId, finalText);
            }
            if (response?.messageId) {
              lastMessageIdRef.current = response.messageId;
            }
            const convo = data.conversation as { conversationId?: string } | undefined;
            adoptConversationId(convo?.conversationId);
            sseRef.current = null;
            streamIdRef.current = null;
            setIsStreaming(false);
            // The agent may have written deliverables — refresh the workspace tree.
            queryClient.invalidateQueries([QueryKeys.coworkWorkspace, projectId]);
            // The agent may have staged edits — refresh the Pending changes panel.
            queryClient.invalidateQueries([QueryKeys.coworkChanges, projectId]);
            // The agent may have appended to project memory — refresh the Memory tab.
            queryClient.invalidateQueries([QueryKeys.coworkMemory, projectId]);
            // A new chat / title may now exist — refresh the history picker.
            queryClient.invalidateQueries([QueryKeys.coworkConversations, projectId]);
            return;
          }
          if (data.created != null) {
            const convo = data.conversation as { conversationId?: string } | undefined;
            const msg = data.message as { conversationId?: string } | undefined;
            adoptConversationId(convo?.conversationId ?? msg?.conversationId);
            return;
          }
          // Agent content stream: text arrives as `type: 'text'` content parts with the
          // cumulative text in data.text. Tool/step/sync/other parts are skipped here.
          if (data.type != null) {
            if (data.type === ContentTypes.TEXT && typeof data.text === 'string') {
              setAssistantText(assistantId, data.text as string);
            }
            return;
          }
          // Agent run-step events → build the trace (tool calls + outputs).
          if (typeof data.event === 'string') {
            handleStepEvent(data.event as string, data.data, setTrace);
            return;
          }
          if (data.sync != null) {
            return;
          }
          // Fallback simple-text streaming (cumulative).
          const chunk = (data.text ?? data.response) as string | undefined;
          if (data.message != null && typeof chunk === 'string') {
            setAssistantText(assistantId, chunk);
          }
        });

        sse.addEventListener('error', async (e: MessageEvent) => {
          // Token expired → refresh once and re-subscribe, mirroring the normal chat.
          // @ts-ignore - sse.js sets responseCode on the event
          if (e.responseCode === 401 && authToken == null) {
            try {
              const refresh = await request.refreshToken();
              const newToken = refresh?.token ?? '';
              if (newToken) {
                request.dispatchTokenUpdatedEvent(newToken);
                subscribe(streamId, newToken);
                return;
              }
            } catch {
              /* fall through to error display */
            }
          }
          sseRef.current = null;
          setError('The agent stream failed. Check the Code Interpreter setup if it persists.');
          setIsStreaming(false);
        });

        sse.addEventListener('cancel', () => setIsStreaming(false));
        sse.stream();
      };

      request
        .post(server, payload)
        .then((res: { streamId?: string; conversationId?: string } | undefined) => {
          if (res?.conversationId) {
            adoptConversationId(res.conversationId);
          }
          if (!res?.streamId) {
            setError('Could not start the agent stream.');
            setIsStreaming(false);
            return;
          }
          streamIdRef.current = res.streamId;
          subscribe(res.streamId);
        })
        .catch(() => {
          setError('Could not reach the agent.');
          setIsStreaming(false);
        });
    },
    [isStreaming, token, projectId, queryClient, setAssistantText, adoptConversationId, model, provider, onSessionStart],
  );

  /**
   * Remove a message and everything after it (used when the user edits a
   * previous message — wipe the old exchange before re-sending).
   */
  const removeFrom = useCallback((fromId: string) => {
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === fromId);
      return idx === -1 ? prev : prev.slice(0, idx);
    });
  }, []);

  /** Close the active SSE stream and tell the server to abort the job. */
  const stop = useCallback(() => {
    const sse = sseRef.current;
    const sid = streamIdRef.current;
    const cid = conversationIdRef.current;
    sse?.close();
    sseRef.current = null;
    streamIdRef.current = null;
    setIsStreaming(false);
    // Drop the empty assistant placeholder if nothing was generated yet.
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      return last?.role === 'assistant' && !last.text ? prev.slice(0, -1) : prev;
    });
    if (sid || cid) {
      abortStream({ streamId: sid ?? undefined, conversationId: cid ?? undefined }).catch(() => {});
    }
  }, []);

  return { messages, isStreaming, error, send, stop, removeFrom, loadOlder, hasMore, isLoadingOlder, trace };
}
