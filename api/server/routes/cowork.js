// cowork — REST routes: Cowork projects + their per-project workspaces.
//
// Workspaces are keyed by Cowork **projectId** (separate CoworkProject collection).
// These are the UI-facing endpoints (browse, upload, download, delete); the agent
// reads/writes the workspace via execute_code + the sandbox file-sync, not these.
const path = require('path');
const fs = require('fs').promises;
const multer = require('multer');
const express = require('express');
const { logger } = require('@librechat/data-schemas');
const { CoworkWorkspaceService, listBuiltinSkills } = require('@librechat/api');
const requireJwtAuth = require('~/server/middleware/requireJwtAuth');
const {
  createCoworkProject,
  getUserCoworkProjects,
  getUserCoworkProject,
  updateCoworkProject,
  deleteCoworkProject,
  addCoworkProjectConversation,
  getCoworkProjectConversations,
  getCoworkConversationMessages,
} = require('~/models/CoworkProject');
const paths = require('~/config/paths');

const router = express.Router();
router.use(requireJwtAuth);

const workspaceRoot = process.env.COWORK_WORKSPACE_ROOT || paths.coworkWorkspaces;
const skillsRoot = process.env.COWORK_SKILLS_ROOT || paths.coworkSkillsRoot;
const quotaMB = parseInt(process.env.COWORK_WORKSPACE_QUOTA_MB || '', 10);
const quotaBytes = Number.isFinite(quotaMB) && quotaMB > 0 ? quotaMB * 1024 * 1024 : undefined;

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
  try {
    const project = await deleteCoworkProject({ user: req.user.id, projectId: req.params.projectId });
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    res.status(200).json({ deleted: project._id });
  } catch {
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
    const userSkills = allSkills
      .filter((s) => s.id !== 'skill-creator')
      .map((s) => ({ ...s, enabled: enabledSet.has(s.id) }));
    res.status(200).json(userSkills);
  } catch (error) {
    logger.error('[/cowork skills] Error', error);
    res.status(500).json({ message: 'Error listing skills' });
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
    return new CoworkWorkspaceService({ root: workspaceRoot, projectId, quotaBytes });
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
