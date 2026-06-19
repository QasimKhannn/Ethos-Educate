// cowork — Phase 1: headless runner. Executes a Cowork agent run for a routine WITHOUT an HTTP
// request or SSE stream, then persists the result as an assistant message in the project.
//
// How it works: the normal run is driven by the agents controller, which relies on middleware
// (buildEndpointOption) + initializeClient + client.sendMessage. None of that actually needs the
// live HTTP response — the agent run uses stubbable onProgress callbacks, and persistence only needs
// `req.user.id`. So we construct a synthetic req + a no-op res, reuse the SAME buildEndpointOption
// middleware to assemble endpointOption (incl. the loaded Cowork agent), then run the agent and save.
//
// Phase 1 scope: connectors/write-gate behave exactly as in normal chat. Scheduling (Phase 2),
// delivery options (Phase 4), and the approval queue (Phase 5) are layered on later.
const crypto = require('crypto');
const { logger } = require('@librechat/data-schemas');
const { Constants } = require('librechat-data-provider');
const { CoworkWorkspaceService } = require('@librechat/api');
const { getAppConfig } = require('~/server/services/Config');
const buildEndpointOption = require('~/server/middleware/buildEndpointOption');
const { initializeClient } = require('~/server/services/Endpoints/agents/initialize');
const { saveConvo } = require('~/models/Conversation');
const { getMessages } = require('~/models/Message');
const { addCoworkProjectConversation } = require('~/models/CoworkProject');
const { markRoutineRun } = require('~/models/CoworkRoutine');
const { recordRunStart, recordRunEnd } = require('~/models/CoworkRoutineRun');
const { User } = require('~/db/models');
const paths = require('~/config/paths');

// Matches the seeded Cowork agent id (config/seed-cowork-agent.js) and the client's COWORK_AGENT_ID.
const COWORK_AGENT_ID = 'agent_cowork_default';

// Workspace resolution for Phase 4 'file' delivery — mirrors api/server/routes/cowork.js so a
// delivered report lands in the same place the UI reads from, with the same quota.
const WORKSPACE_ROOT = process.env.COWORK_WORKSPACE_ROOT || paths.coworkWorkspaces;
const QUOTA_MB = parseInt(process.env.COWORK_WORKSPACE_QUOTA_MB || '', 10);
const QUOTA_BYTES = Number.isFinite(QUOTA_MB) && QUOTA_MB > 0 ? QUOTA_MB * 1024 * 1024 : undefined;

// Phase 6: hard time limit for a single run; a hung run is aborted and recorded as a failure.
const RUN_TIMEOUT_MS = (() => {
  const n = parseInt(process.env.COWORK_ROUTINES_RUN_TIMEOUT_MS || '', 10);
  return Number.isFinite(n) && n > 0 ? n : 5 * 60 * 1000;
})();

/** Pull plain text out of a persisted message (handles both `text` and agent `content` arrays). */
function messageToText(message) {
  if (message?.text && String(message.text).trim()) {
    return String(message.text);
  }
  if (Array.isArray(message?.content)) {
    return message.content
      .filter((part) => part?.type === 'text')
      .map((part) => (typeof part.text === 'string' ? part.text : part.text?.value || ''))
      .join('\n')
      .trim();
  }
  return '';
}

/** Fetch the final assistant text for a conversation (the routine run's result). */
async function getFinalAssistantText(conversationId) {
  const messages = await getMessages({ conversationId });
  const assistantMessages = (messages || []).filter((m) => m && m.isCreatedByUser === false);
  for (let i = assistantMessages.length - 1; i >= 0; i--) {
    const text = messageToText(assistantMessages[i]);
    if (text && text.trim()) {
      return text;
    }
  }
  return '';
}

/** Sanitize a routine name into a filesystem-safe folder segment. */
function safeSegment(name) {
  return (
    String(name || 'routine')
      .replace(/[^a-zA-Z0-9-_ ]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 64) || 'routine'
  );
}

/**
 * Deliver a run's result as a Markdown file in the project workspace under
 * `output/routines/<name>/<timestamp>.md`. Returns the workspace-relative path written, or null
 * if there was nothing to write. Path-safety and quota are enforced by CoworkWorkspaceService.
 */
async function deliverToFile({ routine, projectId, conversationId, trigger }) {
  const text = await getFinalAssistantText(conversationId);
  if (!text || !text.trim()) {
    return null;
  }
  const ws = new CoworkWorkspaceService({
    root: WORKSPACE_ROOT,
    projectId,
    quotaBytes: QUOTA_BYTES,
  });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const relPath = `output/routines/${safeSegment(routine.name)}/${stamp}.md`;
  const header = `# ${routine.name || 'Routine run'}\n\n_Run ${new Date().toISOString()} (${trigger})_\n\n`;
  await ws.writeFile(relPath, Buffer.from(header + text, 'utf8'));
  return relPath;
}

/** A no-op Express response. buildEndpointOption only writes to `res` on error (via handleError). */
function makeNoopRes(onError) {
  const res = {
    headersSent: false,
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    set() {
      return this;
    },
    setHeader() {
      return this;
    },
    json(body) {
      // During buildEndpointOption, a json() call means an error path was hit.
      if (this.statusCode >= 400 && typeof onError === 'function') {
        onError(new Error(body?.text || body?.message || 'buildEndpointOption failed'));
      }
      return this;
    },
    write() {
      return true;
    },
    end() {},
    on() {},
    once() {},
    removeListener() {},
  };
  return res;
}

/**
 * Execute a routine's prompt headlessly and persist the result.
 * @param {object} routine - a CoworkRoutine document ({ _id, user, projectId, prompt, mode }).
 * @returns {Promise<{ conversationId: string, status: 'success'|'error', error?: string }>}
 */
async function runRoutine(routine, options = {}) {
  const userId = routine.user;
  const projectId = routine.projectId;
  const mode = routine.mode || 'agent';
  const trigger = options.trigger === 'scheduled' ? 'scheduled' : 'manual';
  const conversationId = crypto.randomUUID();

  await markRoutineRun({ routineId: routine._id, status: 'running' });

  // Phase 4: open a run-history record (best-effort — never block the run on history bookkeeping).
  let runId = null;
  try {
    const run = await recordRunStart({ routineId: routine._id, user: userId, projectId, trigger });
    runId = run?._id;
  } catch (historyError) {
    logger.warn(`[CoworkRoutineRunner] could not record run start for ${routine._id}`, historyError);
  }

  try {
    const user = await User.findById(userId).lean();
    if (!user) {
      throw new Error('Routine owner not found');
    }

    const appConfig = await getAppConfig({ role: user.role });

    // Synthetic request mirroring what the agents controller would receive for a Cowork run.
    const req = {
      user: { ...user, id: String(user._id || userId) },
      config: appConfig,
      baseUrl: '/api/agents',
      // file uploads / params not used by a routine run
      app: { locals: {} },
      params: {},
      query: {},
      body: {
        endpoint: 'agents',
        agent_id: COWORK_AGENT_ID,
        text: routine.prompt,
        conversationId,
        parentMessageId: Constants.NO_PARENT,
        coworkProjectId: projectId,
        coworkMode: mode,
        // Phase 5: mark this as a headless/unattended run (no human to approve writes mid-run).
        // initialize.js withholds write-capable connectors unless the routine opted into autoApprove.
        coworkUnattended: true,
        coworkAutoApprove: routine.autoApprove === true,
        isRegenerate: false,
        isContinued: false,
        isEdited: false,
        editedContent: null,
        ephemeralAgent: null,
      },
    };

    const onErrorRef = {};
    const res = makeNoopRes((err) => onErrorRef.fn && onErrorRef.fn(err));

    // Build endpointOption (loads the Cowork agent, resolves model/provider) via the real middleware.
    await new Promise((resolve, reject) => {
      onErrorRef.fn = reject;
      buildEndpointOption(req, res, (err) => (err ? reject(err) : resolve()));
    });

    const endpointOption = req.body.endpointOption;
    if (!endpointOption) {
      throw new Error('Failed to build endpointOption for routine run');
    }

    const abortController = new AbortController();
    // Phase 6: abort the run if it exceeds the time limit, so a hung routine can't run forever.
    let timedOut = false;
    const runTimer = setTimeout(() => {
      timedOut = true;
      try {
        abortController.abort();
      } catch {
        /* noop */
      }
    }, RUN_TIMEOUT_MS);

    let capturedUserMessage = null;
    let response;
    try {
      const initResult = await initializeClient({
        req,
        res,
        endpointOption,
        signal: abortController.signal,
      });
      const client = initResult.client;
      if (!client) {
        throw new Error('Failed to initialize agent client for routine run');
      }

      response = await client.sendMessage(routine.prompt, {
        user: userId,
        conversationId,
        parentMessageId: Constants.NO_PARENT,
        isRegenerate: false,
        isContinued: false,
        editedContent: null,
        overrideParentMessageId: null,
        abortController,
        userMCPAuthMap: initResult.userMCPAuthMap,
        // Headless: swallow progress; the agent run does not write to a real response stream.
        onStart: (userMessage) => {
          capturedUserMessage = userMessage;
        },
        getReqData: (data) => {
          if (data?.userMessage) {
            capturedUserMessage = data.userMessage;
          }
        },
        progressOptions: { res },
      });
    } catch (runErr) {
      if (timedOut) {
        throw new Error(`Run exceeded the time limit (${Math.round(RUN_TIMEOUT_MS / 1000)}s) and was aborted`);
      }
      throw runErr;
    } finally {
      clearTimeout(runTimer);
    }

    // Ensure persistence completed before we report success.
    if (response?.databasePromise) {
      await response.databasePromise;
    }
    void capturedUserMessage;

    // Make the run visible: ensure a Conversation doc exists and link it to the project.
    await saveConvo(
      req,
      {
        conversationId,
        endpoint: 'agents',
        agent_id: COWORK_AGENT_ID,
        title: routine.name || 'Routine run',
      },
      { context: 'CoworkRoutineRunner.runRoutine' },
    );
    await addCoworkProjectConversation({ user: userId, projectId, conversationId });

    // Phase 4: optional 'file' delivery — also save the result as a workspace Markdown file.
    let deliveredPath = null;
    if (routine.deliveryTarget === 'file') {
      try {
        deliveredPath = await deliverToFile({ routine, projectId, conversationId, trigger });
        if (deliveredPath) {
          logger.info(`[CoworkRoutineRunner] routine ${routine._id} delivered → ${deliveredPath}`);
        }
      } catch (deliveryError) {
        // Delivery failure must not fail the run — the result is still in the conversation.
        logger.warn(`[CoworkRoutineRunner] file delivery failed for ${routine._id}`, deliveryError);
      }
    }

    await markRoutineRun({ routineId: routine._id, status: 'success', conversationId });
    await recordRunEnd({ runId, status: 'success', conversationId, deliveredPath });
    logger.info(`[CoworkRoutineRunner] routine ${routine._id} ran ok → convo ${conversationId}`);
    return { conversationId, status: 'success', deliveredPath };
  } catch (error) {
    logger.error(`[CoworkRoutineRunner] routine ${routine?._id} failed`, error);
    await markRoutineRun({
      routineId: routine._id,
      status: 'error',
      error: error?.message || String(error),
      conversationId,
    });
    await recordRunEnd({
      runId,
      status: 'error',
      error: error?.message || String(error),
      conversationId,
    });
    return { conversationId, status: 'error', error: error?.message || String(error) };
  }
}

module.exports = { runRoutine, COWORK_AGENT_ID };
