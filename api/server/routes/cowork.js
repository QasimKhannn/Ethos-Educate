// cowork — REST routes: Cowork projects + their per-project workspaces.
//
// Workspaces are keyed by Cowork **projectId** (separate CoworkProject collection).
// These are the UI-facing endpoints (browse, upload, download, delete); the agent
// reads/writes the workspace via execute_code + the sandbox file-sync, not these.
const path = require('path');
const fs = require('fs').promises;
const multer = require('multer');
const archiver = require('archiver');
const express = require('express');
const { logger } = require('@librechat/data-schemas');
const {
  CoworkWorkspaceService,
  listBuiltinSkills,
  listCoworkConnectors,
  getCoworkConnector,
} = require('@librechat/api');
const { Constants } = require('librechat-data-provider');
const {
  updateUserPluginAuth,
  getUserPluginAuthValue,
  deleteUserPluginAuth,
} = require('~/server/services/PluginService');
const { Message, Conversation } = require('~/db/models');
const requireJwtAuth = require('~/server/middleware/requireJwtAuth');
const {
  createCoworkProject,
  getUserCoworkProjects,
  getUserCoworkProject,
  updateCoworkProject,
  deleteCoworkProject,
  addCoworkProjectConversation,
  removeCoworkConversation,
  getCoworkProjectConversations,
  getCoworkConversationMessages,
} = require('~/models/CoworkProject');
const {
  createCoworkRoutine,
  getUserCoworkRoutines,
  getCoworkRoutine,
  updateCoworkRoutine,
  deleteCoworkRoutine,
} = require('~/models/CoworkRoutine');
const { getRoutineRuns, deleteRoutineRuns } = require('~/models/CoworkRoutineRun');
const {
  createCoworkSkill,
  getUserCoworkSkills,
  deleteCoworkSkill,
} = require('~/models/CoworkSkill');
const { runRoutine } = require('~/server/services/Cowork/CoworkRoutineRunner');
const { getCoworkAccessPolicy, canUseCowork } = require('~/server/services/AdminConfigService');
const paths = require('~/config/paths');

const router = express.Router();
router.use(requireJwtAuth);

// cowork — admin access gate. `/access` is authed-but-ungated so the client can ask whether the
// user may use Cowork; everything declared after the router.use() below requires access (403 if not).
router.get('/access', async (req, res) => {
  try {
    const policy = await getCoworkAccessPolicy();
    res.status(200).json({
      allowed: canUseCowork(req.user, policy),
      enabled: policy.enabled,
      mode: policy.mode,
    });
  } catch (error) {
    logger.error('[/cowork access] check error', error);
    res.status(500).json({ message: 'Error checking Cowork access' });
  }
});

async function requireCoworkAccess(req, res, next) {
  try {
    const policy = await getCoworkAccessPolicy();
    if (canUseCowork(req.user, policy)) {
      return next();
    }
    return res.status(403).json({ message: 'You do not have access to Cowork.' });
  } catch (error) {
    logger.error('[/cowork access] gate error', error);
    return res.status(500).json({ message: 'Cowork access check failed' });
  }
}
router.use(requireCoworkAccess);

const workspaceRoot = process.env.COWORK_WORKSPACE_ROOT || paths.coworkWorkspaces;
const skillsRoot = process.env.COWORK_SKILLS_ROOT || paths.coworkSkillsRoot;
const quotaMB = parseInt(process.env.COWORK_WORKSPACE_QUOTA_MB || '', 10);
const quotaBytes = Number.isFinite(quotaMB) && quotaMB > 0 ? quotaMB * 1024 * 1024 : undefined;
// Char budget for the always-injected core memory (~4 chars/token). Unset → service default.
const memoryTokenBudget = parseInt(process.env.COWORK_MEMORY_TOKEN_BUDGET || '', 10);
const memoryCharBudget =
  Number.isFinite(memoryTokenBudget) && memoryTokenBudget > 0 ? memoryTokenBudget * 4 : undefined;

// Uploads stream to a temp dir on disk (NOT into memory), so files/folders of any
// size are supported. Total size is governed by the optional workspace quota, not a
// per-file cap. Set COWORK_UPLOAD_LIMIT_MB only if you want an explicit per-file cap.
const tmpUploadDir = path.join(workspaceRoot, '.uploads-tmp');
const uploadLimitRaw = parseInt(process.env.COWORK_UPLOAD_LIMIT_MB || '', 10);
const uploadLimitMB =
  Number.isFinite(uploadLimitRaw) && uploadLimitRaw > 0 ? uploadLimitRaw : undefined;

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      fs.mkdir(tmpUploadDir, { recursive: true })
        .then(() => cb(null, tmpUploadDir))
        .catch(cb);
    },
    filename: (req, file, cb) =>
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}`),
  }),
  limits: {
    // relativePaths JSON for big folder uploads can be large — allow it.
    fieldSize: 256 * 1024 * 1024,
    ...(uploadLimitMB ? { fileSize: uploadLimitMB * 1024 * 1024 } : {}),
  },
});

// upload.any() accepts file parts under any field name, avoiding multer's
// "Unexpected field" error; surfaces a clear message on the optional size cap.
const uploadFiles = (req, res, next) => {
  upload.any()(req, res, (err) => {
    if (!err) {
      return next();
    }
    const tooLarge = err.code === 'LIMIT_FILE_SIZE';
    logger.error('[/cowork upload] multer error', err);
    return res.status(tooLarge ? 413 : 400).json({
      message: tooLarge
        ? `A file exceeds the ${uploadLimitMB} MB per-file limit`
        : 'Upload failed',
    });
  });
};

async function moveFile(src, dest) {
  try {
    await fs.rename(src, dest);
  } catch (err) {
    if (err.code === 'EXDEV') {
      await fs.copyFile(src, dest);
      await fs.unlink(src);
    } else {
      throw err;
    }
  }
}

// Server-side safety net mirroring the client's folder-upload filter.
const IGNORE_DIRS = new Set([
  'node_modules', '.git', '.svn', '.hg', '.idea', '.vscode', 'dist', 'build', 'out',
  '.next', '.nuxt', '.cache', '.turbo', 'coverage', '__pycache__', '.venv', 'venv',
  '.pytest_cache', '.parcel-cache', '.gradle', 'target',
]);
const IGNORE_FILES = new Set(['.DS_Store', 'Thumbs.db']);

function isIgnoredPath(rel) {
  const parts = rel.split('/');
  if (parts.some((seg) => IGNORE_DIRS.has(seg))) {
    return true;
  }
  return IGNORE_FILES.has(parts[parts.length - 1]);
}

async function deleteCoworkConversationDocuments({ userId, conversationIds }) {
  const ids = [
    ...new Set(
      (Array.isArray(conversationIds) ? conversationIds : []).filter(
        (id) => typeof id === 'string' && id.trim(),
      ),
    ),
  ];

  if (ids.length === 0) {
    return { messagesDeleted: 0, conversationsDeleted: 0 };
  }

  const CHUNK = 500;
  let messagesDeleted = 0;
  let hasMore = true;

  while (hasMore) {
    const docs = await Message.find({ user: userId, conversationId: { $in: ids } })
      .select('_id')
      .limit(CHUNK)
      .lean();

    if (docs.length === 0) {
      break;
    }

    const result = await Message.deleteMany({ _id: { $in: docs.map((d) => d._id) } });
    messagesDeleted += result.deletedCount || 0;
    hasMore = docs.length === CHUNK;
  }

  const conversationsResult = await Conversation.deleteMany({
    user: userId,
    conversationId: { $in: ids },
  });

  return {
    messagesDeleted,
    conversationsDeleted: conversationsResult.deletedCount || 0,
  };
}

// ---------------------------------------------------------------------------
// Cowork project CRUD. Defined BEFORE the workspace routes so the literal
// "/projects" path is matched ahead of any other patterns.
// ---------------------------------------------------------------------------

router.get('/projects', async (req, res) => {
  try {
    const projects = await getUserCoworkProjects(req.user.id);
    res.status(200).json(projects);
  } catch (error) {
    logger.error('[/cowork/projects] list error', error);
    res.status(500).json({ message: 'Error fetching projects' });
  }
});

router.post('/projects', async (req, res) => {
  try {
    const project = await createCoworkProject({
      user: req.user.id,
      name: req.body?.name,
      description: req.body?.description,
      instructions: req.body?.instructions,
    });
    res.status(201).json(project);
  } catch (error) {
    res.status(400).json({ message: error.message || 'Error creating project' });
  }
});

router.get('/projects/:projectId', async (req, res) => {
  try {
    const project = await getUserCoworkProject({ user: req.user.id, projectId: req.params.projectId });
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    res.status(200).json(project);
  } catch {
    res.status(404).json({ message: 'Project not found' });
  }
});

router.patch('/projects/:projectId', async (req, res) => {
  try {
    const project = await updateCoworkProject({
      user: req.user.id,
      projectId: req.params.projectId,
      name: req.body?.name,
      description: req.body?.description,
      instructions: req.body?.instructions,
      enabledSkills: req.body?.enabledSkills,
      enabledConnectors: req.body?.enabledConnectors,
      model: req.body?.model,
      provider: req.body?.provider,
    });
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    res.status(200).json(project);
  } catch (error) {
    res.status(400).json({ message: error.message || 'Error updating project' });
  }
});

router.delete('/projects/:projectId', async (req, res) => {
  const userId = req.user.id;
  const { projectId } = req.params;

  try {
    const project = await getUserCoworkProject({ user: userId, projectId });
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const cleanup = await deleteCoworkConversationDocuments({
      userId,
      conversationIds: project.conversationIds,
    });

    const deletedProject = await deleteCoworkProject({ user: userId, projectId });
    if (!deletedProject) {
      return res.status(404).json({ message: 'Project not found' });
    }

    res.status(200).json({
      deleted: String(deletedProject._id),
      conversationsDeleted: cleanup.conversationsDeleted,
      messagesDeleted: cleanup.messagesDeleted,
    });
  } catch (error) {
    logger.error('[/cowork/projects] delete error', error);
    res.status(500).json({ message: 'Error deleting project' });
  }
});

/**
 * GET /api/cowork/projects/:projectId/skills
 * Lists available builtin skills with an `enabled` flag derived from the project's
 * enabledSkills array. Owner-scoped — verifies the project belongs to the caller.
 * skill-creator is excluded from the user-facing list (meta skill, not a document task).
 */
router.get('/projects/:projectId/skills', async (req, res) => {
  try {
    const project = await getUserCoworkProject({ user: req.user.id, projectId: req.params.projectId });
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    const enabledSet = new Set(Array.isArray(project.enabledSkills) ? project.enabledSkills : []);
    const allSkills = await listBuiltinSkills(skillsRoot);
    // Exclude the meta skill-creator from the user-facing panel.
    const builtinItems = allSkills
      .filter((s) => s.id !== 'skill-creator')
      .map((s) => ({ ...s, enabled: enabledSet.has(s.id) }));
    // A2: append this user's custom skills. Enabled per-project via the id form
    // `custom:<_id>` stored in the project's enabledSkills.
    const customSkills = await getUserCoworkSkills({ user: req.user.id });
    const customItems = customSkills.map((s) => {
      const id = `custom:${String(s._id)}`;
      return {
        id,
        skillId: String(s._id),
        name: s.name,
        description: s.description || '',
        source: 'custom',
        enabled: enabledSet.has(id),
      };
    });
    res.status(200).json([...builtinItems, ...customItems]);
  } catch (error) {
    logger.error('[/cowork skills] Error', error);
    res.status(500).json({ message: 'Error listing skills' });
  }
});

/**
 * POST /api/cowork/skills
 * Create a per-user CUSTOM skill (markdown instructions the coworker follows). User-scoped;
 * not tied to a project. Enable it per-project from the Skills tab (stores `custom:<id>`).
 */
router.post('/skills', async (req, res) => {
  try {
    const skill = await createCoworkSkill({
      user: req.user.id,
      name: req.body?.name,
      description: req.body?.description,
      content: req.body?.content,
    });
    res.status(201).json(skill);
  } catch (error) {
    logger.error('[/cowork skills create] Error', error);
    res.status(400).json({ message: error.message || 'Error creating skill' });
  }
});

/**
 * DELETE /api/cowork/skills/:skillId
 * Delete one of the caller's custom skills. Ownership-scoped. A project still referencing
 * it via `custom:<id>` simply ignores the missing skill at run time (fails safe).
 */
router.delete('/skills/:skillId', async (req, res) => {
  try {
    const deleted = await deleteCoworkSkill({ user: req.user.id, skillId: req.params.skillId });
    if (!deleted) {
      return res.status(404).json({ message: 'Skill not found' });
    }
    res.status(200).json({ deleted: String(deleted._id) });
  } catch (error) {
    logger.error('[/cowork skills delete] Error', error);
    res.status(500).json({ message: 'Error deleting skill' });
  }
});

// ---------------------------------------------------------------------------
// cowork — edit review: staged proposed changes + undo checkpoints.
// All owner-scoped via loadWorkspace; the staging/history lives under hidden
// .cowork/. New-file creation does NOT use these — only edits the user reviews.
// ---------------------------------------------------------------------------

/** GET /projects/:projectId/changes — list staged proposed edits. */
router.get('/projects/:projectId/changes', async (req, res) => {
  try {
    const ws = await loadWorkspace(req, res);
    if (!ws) {
      return;
    }
    res.status(200).json(await ws.listProposedChanges());
  } catch (error) {
    logger.error('[/cowork changes] list error', error);
    res.status(500).json({ message: 'Error listing changes' });
  }
});

/** GET /projects/:projectId/changes/diff?path= — diff payload for one staged change. */
router.get('/projects/:projectId/changes/diff', async (req, res) => {
  try {
    const ws = await loadWorkspace(req, res);
    if (!ws) {
      return;
    }
    const relPath = String(req.query.path || '');
    const change = (await ws.listProposedChanges()).find((c) => c.path === relPath);
    if (!change) {
      return res.status(404).json({ message: 'Change not found' });
    }
    if (change.kind === 'text') {
      const proposedBuf = await ws.readProposed(relPath);
      const liveBuf = change.status === 'modified' ? await ws.readFile(relPath) : null;
      return res.status(200).json({
        ...change,
        live: liveBuf ? liveBuf.toString('utf8') : null,
        proposed: proposedBuf.toString('utf8'),
      });
    }
    res.status(200).json({ ...change, live: null, proposed: null });
  } catch (error) {
    logger.error('[/cowork changes diff] error', error);
    res.status(500).json({ message: 'Error reading diff' });
  }
});

/** POST /projects/:projectId/changes/apply — apply staged changes, create a checkpoint. */
router.post('/projects/:projectId/changes/apply', async (req, res) => {
  try {
    const ws = await loadWorkspace(req, res);
    if (!ws) {
      return;
    }
    const paths = Array.isArray(req.body?.paths) ? req.body.paths : undefined;
    const message = typeof req.body?.message === 'string' ? req.body.message : undefined;
    res.status(200).json(await ws.applyProposed(paths, message));
  } catch (error) {
    const msg = error.message || 'Error applying changes';
    const status = /quota exceeded/.test(msg) ? 400 : /No matching/.test(msg) ? 404 : 500;
    if (status === 500) {
      logger.error('[/cowork changes apply] error', error);
    }
    res.status(status).json({ message: msg });
  }
});

/** DELETE /projects/:projectId/changes?path=  OR  ?all=true — discard staged change(s). */
router.delete('/projects/:projectId/changes', async (req, res) => {
  try {
    const ws = await loadWorkspace(req, res);
    if (!ws) {
      return;
    }
    if (String(req.query.all) === 'true') {
      await ws.discardAllProposed();
      return res.status(200).json({ discarded: 'all' });
    }
    const relPath = String(req.query.path || '');
    if (!relPath) {
      return res.status(400).json({ message: 'path or all=true is required' });
    }
    await ws.discardProposed(relPath);
    res.status(200).json({ discarded: relPath });
  } catch (error) {
    logger.error('[/cowork changes delete] error', error);
    res.status(400).json({ message: error.message || 'Error discarding change' });
  }
});

/** GET /projects/:projectId/checkpoints — undo checkpoints, newest first. */
router.get('/projects/:projectId/checkpoints', async (req, res) => {
  try {
    const ws = await loadWorkspace(req, res);
    if (!ws) {
      return;
    }
    res.status(200).json(await ws.listCheckpoints());
  } catch (error) {
    logger.error('[/cowork checkpoints] list error', error);
    res.status(500).json({ message: 'Error listing checkpoints' });
  }
});

/** POST /projects/:projectId/checkpoints/:checkpointId/restore — undo to a checkpoint. */
router.post('/projects/:projectId/checkpoints/:checkpointId/restore', async (req, res) => {
  try {
    const ws = await loadWorkspace(req, res);
    if (!ws) {
      return;
    }
    res.status(200).json(await ws.restoreCheckpoint(req.params.checkpointId));
  } catch (error) {
    const status = /not found/i.test(error.message || '') ? 404 : 500;
    if (status === 500) {
      logger.error('[/cowork checkpoint restore] error', error);
    }
    res.status(status).json({ message: error.message || 'Error restoring checkpoint' });
  }
});

/** GET /projects/:projectId/archive — stream the visible workspace as a .zip. */
router.get('/projects/:projectId/archive', async (req, res) => {
  const ws = await loadWorkspace(req, res);
  if (!ws) {
    return;
  }
  try {
    const files = [];
    const walk = (nodes) => {
      for (const node of nodes) {
        if (node.type === 'directory') {
          walk(node.children || []);
        } else {
          files.push(node.path);
        }
      }
    };
    walk(await ws.getTree());

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="cowork-workspace-${ws.projectId}.zip"`,
    );
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', (err) => {
      logger.error('[/cowork archive] zip error', err);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Error building archive' });
      } else {
        res.end();
      }
    });
    archive.pipe(res);
    for (const rel of files) {
      archive.file(ws.resolve(rel), { name: rel });
    }
    await archive.finalize();
  } catch (error) {
    logger.error('[/cowork archive] error', error);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Error building archive' });
    }
  }
});

// ---------------------------------------------------------------------------
// cowork — project memory. core is injected into the agent every run (budget-capped);
// archive is read-only here and read on demand by the agent via execute_code.
// ---------------------------------------------------------------------------

/** GET /projects/:projectId/memory — the always-injected core memory. */
router.get('/projects/:projectId/memory', async (req, res) => {
  try {
    const ws = await loadWorkspace(req, res);
    if (!ws) {
      return;
    }
    res.status(200).json({ memory: await ws.getMemory() });
  } catch (error) {
    logger.error('[/cowork memory] get error', error);
    res.status(500).json({ message: 'Error reading memory' });
  }
});

/** PUT /projects/:projectId/memory — replace core memory (manual edit). */
router.put('/projects/:projectId/memory', async (req, res) => {
  try {
    const ws = await loadWorkspace(req, res);
    if (!ws) {
      return;
    }
    const memory = typeof req.body?.memory === 'string' ? req.body.memory : '';
    const { overBudget } = await ws.setMemory(memory);
    res.status(200).json({ memory, overBudget });
  } catch (error) {
    logger.error('[/cowork memory] put error', error);
    res.status(400).json({ message: error.message || 'Error saving memory' });
  }
});

/** GET /projects/:projectId/memory/archive — the on-demand long tail (read-only). */
router.get('/projects/:projectId/memory/archive', async (req, res) => {
  try {
    const ws = await loadWorkspace(req, res);
    if (!ws) {
      return;
    }
    res.status(200).json({ archive: await ws.getMemoryArchive() });
  } catch (error) {
    logger.error('[/cowork memory archive] get error', error);
    res.status(500).json({ message: 'Error reading memory archive' });
  }
});

/** GET /api/cowork/projects/:projectId/conversations — list the project's chats. */
router.get('/projects/:projectId/conversations', async (req, res) => {
  try {
    const conversations = await getCoworkProjectConversations({
      user: req.user.id,
      projectId: req.params.projectId,
    });
    if (conversations == null) {
      return res.status(404).json({ message: 'Project not found' });
    }
    res.status(200).json({ conversations });
  } catch (error) {
    res.status(400).json({ message: error.message || 'Error listing conversations' });
  }
});

/**
 * GET /api/cowork/projects/:projectId/conversations/:conversationId/messages
 * Page a conversation's messages (newest-first cursor via ?before=ISO&limit=N).
 */
router.get('/projects/:projectId/conversations/:conversationId/messages', async (req, res) => {
  try {
    const result = await getCoworkConversationMessages({
      user: req.user.id,
      projectId: req.params.projectId,
      conversationId: req.params.conversationId,
      limit: req.query.limit,
      before: req.query.before,
    });
    if (result == null) {
      return res.status(404).json({ message: 'Conversation not found' });
    }
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ message: error.message || 'Error loading messages' });
  }
});

/** POST /api/cowork/projects/:projectId/conversations — link a chat to the project. */
router.post('/projects/:projectId/conversations', async (req, res) => {
  try {
    const project = await addCoworkProjectConversation({
      user: req.user.id,
      projectId: req.params.projectId,
      conversationId: req.body?.conversationId,
    });
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    res.status(200).json({ linked: req.body?.conversationId });
  } catch (error) {
    res.status(400).json({ message: error.message || 'Error linking conversation' });
  }
});

/**
 * DELETE /api/cowork/projects/:projectId/conversations/:conversationId
 *
 * Two-phase delete — responds immediately, then cleans up messages in the background:
 *   1. $pull the conversationId from the project's array → respond 200.
 *   2. Fire-and-forget: delete all messages in 500-doc chunks (50 ms between chunks),
 *      then delete the Conversation document itself.
 *
 * Cowork-only: only touches CoworkProject, Conversation, and Message collections.
 * No effect on the regular LibreChat project/chat system.
 */
router.delete('/projects/:projectId/conversations/:conversationId', async (req, res) => {
  const { projectId, conversationId } = req.params;
  const userId = req.user.id;

  // Verify ownership and $pull in one atomic op.
  let updated;
  try {
    updated = await removeCoworkConversation({ user: userId, projectId, conversationId });
  } catch (error) {
    logger.error('[/cowork] delete conversation error', error);
    return res.status(500).json({ message: 'Error deleting conversation' });
  }

  if (!updated) {
    return res.status(404).json({ message: 'Project not found' });
  }

  // Respond immediately — client gets its optimistic update confirmed.
  res.status(200).json({ deleted: conversationId });

  // Fire-and-forget background cleanup: remove messages + conversation doc.
  // We intentionally do NOT await this — the caller already has its 200.
  setImmediate(async () => {
    try {
      const CHUNK = 500;
      const DELAY_MS = 50;

      // Delete messages in chunks to avoid large in-memory arrays.
      let deleted = 0;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const docs = await Message.find({ user: userId, conversationId })
          .select('_id')
          .limit(CHUNK)
          .lean();
        if (!docs.length) {
          break;
        }
        const ids = docs.map((d) => d._id);
        const result = await Message.deleteMany({ _id: { $in: ids } });
        deleted += result.deletedCount || 0;
        if (docs.length < CHUNK) {
          break;
        }
        await new Promise((r) => setTimeout(r, DELAY_MS));
      }

      // Delete the Conversation document.
      await Conversation.deleteOne({ user: userId, conversationId });

      logger.debug(`[/cowork] background cleanup: deleted ${deleted} messages for conversation ${conversationId}`);
    } catch (bgErr) {
      logger.error(`[/cowork] background cleanup failed for conversation ${conversationId}`, bgErr);
    }
  });
});

// ---------------------------------------------------------------------------
// cowork — connectors: catalog + per-teacher credentials (API-key connectors).
// Credentials are stored per user, encrypted, via the existing PluginService, namespaced
// by a "cowork_connector_<id>" plugin key so they never collide with other tools.
// Enabling/disabling a connector for a project is done via the project update route
// (enabledConnectors). OAuth connect/disconnect is wired per connector in a later phase.
// ---------------------------------------------------------------------------

// Where a connector's per-teacher credentials are stored. For connectors backed by an MCP server,
// store under that server's per-user var key (`mcp_<server>`) — this is the SAME place LibreChat reads
// `customUserVars` from, so the saved key is injected into the MCP server automatically (no extra
// plumbing). Connectors without a server yet fall back to a cowork-local key.
const connectorStoreKey = (def) =>
  def.mcpServer ? `${Constants.mcp_prefix}${def.mcpServer}` : `cowork_connector_${def.id}`;

/** Per-user connection status for a connector (platform=always; apikey=all creds present). */
async function isConnectorConnected(userId, def) {
  if (def.auth === 'platform') {
    return true;
  }
  if (def.auth === 'apikey') {
    const fields = def.credentialFields || [];
    if (fields.length === 0) {
      return false;
    }
    for (const field of fields) {
      const value = await getUserPluginAuthValue(
        userId,
        field.key,
        false,
        connectorStoreKey(def),
      );
      if (!value) {
        return false;
      }
    }
    return true;
  }
  // oauth — connection wiring lands in a later phase.
  return false;
}

/** GET /api/cowork/connectors — catalog + this user's connection status (no secret values). */
router.get('/connectors', async (req, res) => {
  try {
    const connectors = await Promise.all(
      listCoworkConnectors().map(async (def) => ({
        id: def.id,
        label: def.label,
        description: def.description,
        auth: def.auth,
        help: def.help,
        credentialFields: def.credentialFields ?? [],
        hasWriteActions: def.hasWriteActions,
        status: def.status,
        // OAuth connectors need the MCP server name so the Connectors tab can drive LibreChat's
        // connect/disconnect flow (without it the UI falls back to "Login coming soon").
        mcpServer: def.mcpServer,
        connected: await isConnectorConnected(req.user.id, def),
      })),
    );
    res.status(200).json(connectors);
  } catch (error) {
    logger.error('[/cowork connectors] list error', error);
    res.status(500).json({ message: 'Error listing connectors' });
  }
});

/** PUT /api/cowork/connectors/:connectorId/credentials — save per-teacher API-key credentials. */
router.put('/connectors/:connectorId/credentials', async (req, res) => {
  try {
    const def = getCoworkConnector(req.params.connectorId);
    if (!def) {
      return res.status(404).json({ message: 'Unknown connector' });
    }
    if (def.auth !== 'apikey') {
      return res.status(400).json({ message: 'This connector does not use API-key credentials' });
    }
    const fields = req.body?.fields || {};
    const pluginKey = connectorStoreKey(def);
    for (const field of def.credentialFields || []) {
      const value = fields[field.key];
      if (typeof value === 'string' && value.trim()) {
        await updateUserPluginAuth(req.user.id, field.key, pluginKey, value.trim());
      }
    }
    res.status(200).json({ connected: await isConnectorConnected(req.user.id, def) });
  } catch (error) {
    logger.error('[/cowork connectors] save credentials error', error);
    res.status(400).json({ message: error.message || 'Error saving credentials' });
  }
});

/** DELETE /api/cowork/connectors/:connectorId/credentials — disconnect (remove all creds). */
router.delete('/connectors/:connectorId/credentials', async (req, res) => {
  try {
    const def = getCoworkConnector(req.params.connectorId);
    if (!def) {
      return res.status(404).json({ message: 'Unknown connector' });
    }
    await deleteUserPluginAuth(req.user.id, null, true, connectorStoreKey(def));
    res.status(200).json({ connected: false });
  } catch (error) {
    logger.error('[/cowork connectors] disconnect error', error);
    res.status(400).json({ message: error.message || 'Error disconnecting' });
  }
});

// ---------------------------------------------------------------------------
// cowork — Routines (scheduled automations). Phase 1: CRUD + run-now (headless run).
// Scheduling (Phase 2), delivery (Phase 4), and the approval queue (Phase 5) are layered on later.
// ---------------------------------------------------------------------------

/** GET /api/cowork/routines?projectId=... — list this user's routines (optionally one project). */
router.get('/routines', async (req, res) => {
  try {
    const routines = await getUserCoworkRoutines({
      user: req.user.id,
      projectId: req.query?.projectId,
    });
    res.status(200).json(routines);
  } catch (error) {
    logger.error('[/cowork routines] list error', error);
    res.status(500).json({ message: 'Error listing routines' });
  }
});

/** POST /api/cowork/routines — create a routine for a project. */
router.post('/routines', async (req, res) => {
  try {
    const routine = await createCoworkRoutine({
      user: req.user.id,
      projectId: req.body?.projectId,
      name: req.body?.name,
      prompt: req.body?.prompt,
      cronExpression: req.body?.cronExpression,
      mode: req.body?.mode,
      enabled: req.body?.enabled,
      autoApprove: req.body?.autoApprove,
      deliveryTarget: req.body?.deliveryTarget,
    });
    res.status(201).json(routine);
  } catch (error) {
    res.status(400).json({ message: error.message || 'Error creating routine' });
  }
});

/** GET /api/cowork/routines/:routineId — fetch one routine. */
router.get('/routines/:routineId', async (req, res) => {
  try {
    const routine = await getCoworkRoutine({ user: req.user.id, routineId: req.params.routineId });
    if (!routine) {
      return res.status(404).json({ message: 'Routine not found' });
    }
    res.status(200).json(routine);
  } catch (error) {
    res.status(400).json({ message: error.message || 'Error fetching routine' });
  }
});

/** PATCH /api/cowork/routines/:routineId — update a routine. */
router.patch('/routines/:routineId', async (req, res) => {
  try {
    const routine = await updateCoworkRoutine({
      user: req.user.id,
      routineId: req.params.routineId,
      name: req.body?.name,
      prompt: req.body?.prompt,
      cronExpression: req.body?.cronExpression,
      mode: req.body?.mode,
      enabled: req.body?.enabled,
      autoApprove: req.body?.autoApprove,
      deliveryTarget: req.body?.deliveryTarget,
    });
    if (!routine) {
      return res.status(404).json({ message: 'Routine not found' });
    }
    res.status(200).json(routine);
  } catch (error) {
    res.status(400).json({ message: error.message || 'Error updating routine' });
  }
});

/** DELETE /api/cowork/routines/:routineId — delete a routine. */
router.delete('/routines/:routineId', async (req, res) => {
  try {
    const deleted = await deleteCoworkRoutine({
      user: req.user.id,
      routineId: req.params.routineId,
    });
    if (!deleted) {
      return res.status(404).json({ message: 'Routine not found' });
    }
    // Clean up the routine's run history too (best-effort).
    await deleteRoutineRuns(req.params.routineId).catch(() => {});
    res.status(200).json({ deleted: true });
  } catch (error) {
    res.status(400).json({ message: error.message || 'Error deleting routine' });
  }
});

/**
 * POST /api/cowork/routines/:routineId/run — run a routine now (headless).
 * Awaits the agent run and returns the outcome + the conversation the result landed in.
 */
router.post('/routines/:routineId/run', async (req, res) => {
  try {
    const routine = await getCoworkRoutine({ user: req.user.id, routineId: req.params.routineId });
    if (!routine) {
      return res.status(404).json({ message: 'Routine not found' });
    }
    const result = await runRoutine(routine, { trigger: 'manual' });
    const status = result.status === 'success' ? 200 : 500;
    res.status(status).json(result);
  } catch (error) {
    logger.error('[/cowork routines] run error', error);
    res.status(500).json({ message: error.message || 'Error running routine' });
  }
});

/**
 * GET /api/cowork/routines/:routineId/runs?limit= — this routine's run history (newest first).
 * Ownership-scoped: 404s unless the routine belongs to the caller.
 */
router.get('/routines/:routineId/runs', async (req, res) => {
  try {
    const routine = await getCoworkRoutine({ user: req.user.id, routineId: req.params.routineId });
    if (!routine) {
      return res.status(404).json({ message: 'Routine not found' });
    }
    const runs = await getRoutineRuns({
      user: req.user.id,
      routineId: req.params.routineId,
      limit: req.query?.limit,
    });
    res.status(200).json(runs);
  } catch (error) {
    logger.error('[/cowork routines] runs list error', error);
    res.status(500).json({ message: error.message || 'Error listing routine runs' });
  }
});

// ---------------------------------------------------------------------------
// Per-project workspace (browse / upload / download / delete).
// ---------------------------------------------------------------------------

/**
 * Verify the Cowork project belongs to the caller, then return a workspace bound
 * to its id. Responds 404/400 and returns null if access is denied.
 */
async function loadWorkspace(req, res) {
  const { projectId } = req.params;
  let project;
  try {
    project = await getUserCoworkProject({ user: req.user.id, projectId });
  } catch {
    project = null;
  }
  if (!project) {
    res.status(404).json({ message: 'Project not found' });
    return null;
  }
  try {
    return new CoworkWorkspaceService({ root: workspaceRoot, projectId, quotaBytes, memoryCharBudget });
  } catch (error) {
    res.status(400).json({ message: error.message || 'Invalid workspace' });
    return null;
  }
}

/** GET /api/cowork/projects/:projectId/tree — full file tree. */
router.get('/projects/:projectId/tree', async (req, res) => {
  try {
    const ws = await loadWorkspace(req, res);
    if (!ws) {
      return;
    }
    const tree = await ws.getTree();
    const usage = await ws.getUsage();
    res.status(200).json({ projectId: ws.projectId, tree, usage, quotaBytes: ws.quotaBytes });
  } catch (error) {
    logger.error('[/cowork tree] Error', error);
    res.status(500).json({ message: 'Error reading workspace' });
  }
});

/** GET /api/cowork/projects/:projectId/file?path=... — inline file content. */
router.get('/projects/:projectId/file', async (req, res) => {
  try {
    const ws = await loadWorkspace(req, res);
    if (!ws) {
      return;
    }
    const relPath = String(req.query.path || '');
    const data = await ws.readFile(relPath);
    res.type(path.basename(relPath));
    res.status(200).send(data);
  } catch (error) {
    handleFileError(res, error, '/cowork file');
  }
});

/** GET /api/cowork/projects/:projectId/download?path=... — file as attachment. */
router.get('/projects/:projectId/download', async (req, res) => {
  try {
    const ws = await loadWorkspace(req, res);
    if (!ws) {
      return;
    }
    const relPath = String(req.query.path || '');
    const data = await ws.readFile(relPath);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(path.basename(relPath))}"`,
    );
    res.type('application/octet-stream');
    res.status(200).send(data);
  } catch (error) {
    handleFileError(res, error, '/cowork download');
  }
});

/**
 * POST /api/cowork/projects/:projectId/upload — upload one OR many files.
 * Accepts a `files` field (one or more). For folder uploads, send a parallel
 * `relativePaths` field (JSON array) so the folder structure is preserved.
 * Optional `?path=<subdir>` prefixes everything.
 */
router.post('/projects/:projectId/upload', uploadFiles, async (req, res) => {
  const files = req.files || [];
  const cleanupTemps = () => Promise.all(files.map((f) => fs.unlink(f.path).catch(() => {})));
  try {
    const ws = await loadWorkspace(req, res);
    if (!ws) {
      await cleanupTemps();
      return;
    }
    if (files.length === 0) {
      return res.status(400).json({ message: 'No files provided' });
    }

    // Optional total-size guard against the workspace quota.
    if (ws.quotaBytes != null) {
      const incoming = files.reduce((n, f) => n + (f.size || 0), 0);
      const usage = await ws.getUsage();
      if (usage + incoming > ws.quotaBytes) {
        await cleanupTemps();
        return res.status(400).json({ message: 'Workspace quota exceeded' });
      }
    }

    let relPaths = [];
    try {
      relPaths = req.body.relativePaths ? JSON.parse(req.body.relativePaths) : [];
    } catch {
      relPaths = [];
    }
    const subdir = String(req.query.path || '').replace(/\/+$/, '');

    const written = [];
    let skipped = 0;
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const rel = (relPaths[i] || f.originalname || `file-${i}`).replace(/^\/+/, '');
      if (isIgnoredPath(rel)) {
        await fs.unlink(f.path).catch(() => {});
        skipped += 1;
        continue;
      }
      const target = subdir ? `${subdir}/${rel}` : rel;
      const absTarget = ws.resolve(target); // path containment; throws on escape
      await fs.mkdir(path.dirname(absTarget), { recursive: true });
      await moveFile(f.path, absTarget);
      written.push(target);
    }
    res.status(201).json({ uploaded: written.length, skipped, paths: written });
  } catch (error) {
    await cleanupTemps();
    if (/escapes workspace/.test(error.message || '')) {
      return res.status(400).json({ message: error.message });
    }
    logger.error('[/cowork upload] Error', error);
    res.status(500).json({ message: 'Error uploading files' });
  }
});

/** DELETE /api/cowork/projects/:projectId/file?path=... — delete a file or folder. */
router.delete('/projects/:projectId/file', async (req, res) => {
  try {
    const ws = await loadWorkspace(req, res);
    if (!ws) {
      return;
    }
    const relPath = String(req.query.path || '');
    await ws.deleteFile(relPath);
    res.status(200).json({ deleted: relPath });
  } catch (error) {
    if (/escapes workspace|Refusing to delete/.test(error.message || '')) {
      return res.status(400).json({ message: error.message });
    }
    logger.error('[/cowork delete] Error', error);
    res.status(500).json({ message: 'Error deleting file' });
  }
});

function handleFileError(res, error, tag) {
  const message = error.message || '';
  if (/escapes workspace/.test(message)) {
    return res.status(400).json({ message });
  }
  if (error.code === 'ENOENT' || /no such file/.test(message)) {
    return res.status(404).json({ message: 'File not found' });
  }
  logger.error(`[${tag}] Error`, error);
  res.status(500).json({ message: 'Error reading file' });
}

module.exports = router;
