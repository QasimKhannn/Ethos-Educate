const express = require('express');
const { logger } = require('@librechat/data-schemas');
const requireJwtAuth = require('~/server/middleware/requireJwtAuth');
const {
  getUserProject,
  getUserProjects,
  addProjectFiles,
  getProjectFiles,
  createUserProject,
  updateUserProject,
  deleteUserProject,
  removeProjectFile,
} = require('~/models/Project');

const router = express.Router();
router.use(requireJwtAuth);

const sendNotFound = (res) => res.status(404).json({ message: 'Project not found' });

router.get('/', async (req, res) => {
  try {
    const projects = await getUserProjects(req.user.id);
    res.status(200).json(projects);
  } catch (error) {
    logger.error('[/projects] Error fetching projects', error);
    res.status(500).json({ message: 'Error fetching projects' });
  }
});

router.post('/', async (req, res) => {
  try {
    const project = await createUserProject({
      user: req.user.id,
      name: req.body?.name,
      description: req.body?.description,
      instructions: req.body?.instructions,
    });
    res.status(201).json(project);
  } catch (error) {
    logger.error('[/projects] Error creating project', error);
    res.status(400).json({ message: error.message || 'Error creating project' });
  }
});

router.get('/:projectId', async (req, res) => {
  try {
    const project = await getUserProject({
      user: req.user.id,
      projectId: req.params.projectId,
    });
    if (!project) {
      return sendNotFound(res);
    }
    res.status(200).json(project);
  } catch (error) {
    logger.error('[/projects/:projectId] Error fetching project', error);
    res.status(500).json({ message: 'Error fetching project' });
  }
});

router.patch('/:projectId', async (req, res) => {
  try {
    const project = await updateUserProject({
      user: req.user.id,
      projectId: req.params.projectId,
      name: req.body?.name,
      description: req.body?.description,
      instructions: req.body?.instructions,
    });
    if (!project) {
      return sendNotFound(res);
    }
    res.status(200).json(project);
  } catch (error) {
    logger.error('[/projects/:projectId] Error updating project', error);
    res.status(400).json({ message: error.message || 'Error updating project' });
  }
});

router.delete('/:projectId', async (req, res) => {
  try {
    const project = await deleteUserProject({
      user: req.user.id,
      projectId: req.params.projectId,
    });
    if (!project) {
      return sendNotFound(res);
    }
    res.status(200).json(project);
  } catch (error) {
    logger.error('[/projects/:projectId] Error deleting project', error);
    res.status(500).json({ message: 'Error deleting project' });
  }
});

router.get('/:projectId/files', async (req, res) => {
  try {
    const project = await getUserProject({
      user: req.user.id,
      projectId: req.params.projectId,
    });
    if (!project) {
      return sendNotFound(res);
    }

    const files = await getProjectFiles({
      user: req.user.id,
      projectId: req.params.projectId,
    });
    res.status(200).json(files);
  } catch (error) {
    logger.error('[/projects/:projectId/files] Error fetching project files', error);
    res.status(500).json({ message: 'Error fetching project files' });
  }
});

router.post('/:projectId/files', async (req, res) => {
  try {
    const project = await addProjectFiles({
      user: req.user.id,
      projectId: req.params.projectId,
      fileIds: req.body?.fileIds,
    });
    if (!project) {
      return sendNotFound(res);
    }
    res.status(200).json(project);
  } catch (error) {
    logger.error('[/projects/:projectId/files] Error adding project files', error);
    res.status(500).json({ message: 'Error adding project files' });
  }
});

router.delete('/:projectId/files/:fileId', async (req, res) => {
  try {
    const project = await removeProjectFile({
      user: req.user.id,
      projectId: req.params.projectId,
      fileId: req.params.fileId,
    });
    if (!project) {
      return sendNotFound(res);
    }
    res.status(200).json(project);
  } catch (error) {
    logger.error('[/projects/:projectId/files/:fileId] Error removing project file', error);
    res.status(500).json({ message: 'Error removing project file' });
  }
});

module.exports = router;
