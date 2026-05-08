const { GLOBAL_PROJECT_NAME } = require('librechat-data-provider').Constants;
const { Project, File, Conversation } = require('~/db/models');

const MAX_PROJECT_NAME_LENGTH = 128;
const MAX_PROJECT_DESCRIPTION_LENGTH = 2048;
const MAX_PROJECT_INSTRUCTIONS_LENGTH = 8000;

const normalizeText = (value, maxLength) => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.slice(0, maxLength);
};

const normalizeFileIds = (fileIds) => {
  if (!Array.isArray(fileIds)) {
    return [];
  }
  return [...new Set(fileIds.filter((fileId) => typeof fileId === 'string' && fileId.trim()))];
};

const userProjectFilter = (user, projectId) => ({ _id: projectId, user });

/**
 * Retrieve a project by ID and convert the found project document to a plain object.
 *
 * @param {string} projectId - The ID of the project to find and return as a plain object.
 * @param {string|string[]} [fieldsToSelect] - The fields to include or exclude in the returned document.
 * @returns {Promise<IMongoProject>} A plain object representing the project document, or `null` if no project is found.
 */
const getProjectById = async function (projectId, fieldsToSelect = null) {
  const query = Project.findById(projectId);

  if (fieldsToSelect) {
    query.select(fieldsToSelect);
  }

  return await query.lean();
};

/**
 * Retrieve a project by name and convert the found project document to a plain object.
 * If the project with the given name doesn't exist and the name is "instance", create it and return the lean version.
 *
 * @param {string} projectName - The name of the project to find or create.
 * @param {string|string[]} [fieldsToSelect] - The fields to include or exclude in the returned document.
 * @returns {Promise<IMongoProject>} A plain object representing the project document.
 */
const getProjectByName = async function (projectName, fieldsToSelect = null) {
  const query = { name: projectName };
  const update = { $setOnInsert: { name: projectName } };
  const options = {
    new: true,
    upsert: projectName === GLOBAL_PROJECT_NAME,
    lean: true,
    select: fieldsToSelect,
  };

  return await Project.findOneAndUpdate(query, update, options);
};

const createUserProject = async ({ user, name, description = '', instructions = '' }) => {
  const normalizedName = normalizeText(name, MAX_PROJECT_NAME_LENGTH);
  if (!normalizedName) {
    throw new Error('Project name is required');
  }

  return await Project.create({
    user,
    name: normalizedName,
    description: normalizeText(description, MAX_PROJECT_DESCRIPTION_LENGTH) ?? '',
    instructions: normalizeText(instructions, MAX_PROJECT_INSTRUCTIONS_LENGTH) ?? '',
  }).then((project) => project.toObject());
};

const getUserProjects = async (user) => {
  return await Project.find({ user }).sort({ updatedAt: -1 }).lean();
};

const getUserProject = async ({ user, projectId }) => {
  return await Project.findOne(userProjectFilter(user, projectId)).lean();
};

const updateUserProject = async ({ user, projectId, name, description, instructions }) => {
  const $set = {};
  const normalizedName = normalizeText(name, MAX_PROJECT_NAME_LENGTH);
  const normalizedDescription = normalizeText(description, MAX_PROJECT_DESCRIPTION_LENGTH);
  const normalizedInstructions = normalizeText(instructions, MAX_PROJECT_INSTRUCTIONS_LENGTH);

  if (normalizedName !== undefined) {
    if (!normalizedName) {
      throw new Error('Project name is required');
    }
    $set.name = normalizedName;
  }
  if (normalizedDescription !== undefined) {
    $set.description = normalizedDescription;
  }
  if (normalizedInstructions !== undefined) {
    $set.instructions = normalizedInstructions;
  }

  if (Object.keys($set).length === 0) {
    return await getUserProject({ user, projectId });
  }

  return await Project.findOneAndUpdate(
    userProjectFilter(user, projectId),
    { $set },
    { new: true },
  ).lean();
};

const deleteUserProject = async ({ user, projectId }) => {
  const project = await Project.findOneAndDelete(userProjectFilter(user, projectId)).lean();
  if (!project) {
    return null;
  }

  await Conversation.updateMany({ user, projectId }, { $unset: { projectId: '' } });
  return project;
};

const addConversationIdToProject = async ({ user, projectId, conversationId }) => {
  if (!projectId || !conversationId) {
    return null;
  }

  return await Project.findOneAndUpdate(
    userProjectFilter(user, projectId),
    { $addToSet: { conversationIds: conversationId } },
    { new: true },
  ).lean();
};

const getProjectFiles = async ({ user, projectId }) => {
  const project = await getUserProject({ user, projectId });
  if (!project?.fileIds?.length) {
    return [];
  }

  return await File.find({
    user,
    file_id: { $in: project.fileIds },
  })
    .select({ text: 0 })
    .sort({ updatedAt: -1 })
    .lean();
};

const addProjectFiles = async ({ user, projectId, fileIds }) => {
  const normalizedFileIds = normalizeFileIds(fileIds);
  if (normalizedFileIds.length === 0) {
    return await getUserProject({ user, projectId });
  }

  const ownedFiles = await File.find({
    user,
    file_id: { $in: normalizedFileIds },
  })
    .select('file_id')
    .lean();
  const ownedFileIds = ownedFiles.map((file) => file.file_id);

  if (ownedFileIds.length === 0) {
    return await getUserProject({ user, projectId });
  }

  return await Project.findOneAndUpdate(
    userProjectFilter(user, projectId),
    { $addToSet: { fileIds: { $each: ownedFileIds } } },
    { new: true },
  ).lean();
};

const removeProjectFile = async ({ user, projectId, fileId }) => {
  return await Project.findOneAndUpdate(
    userProjectFilter(user, projectId),
    { $pull: { fileIds: fileId } },
    { new: true },
  ).lean();
};

/**
 * Add an array of prompt group IDs to a project's promptGroupIds array, ensuring uniqueness.
 *
 * @param {string} projectId - The ID of the project to update.
 * @param {string[]} promptGroupIds - The array of prompt group IDs to add to the project.
 * @returns {Promise<IMongoProject>} The updated project document.
 */
const addGroupIdsToProject = async function (projectId, promptGroupIds) {
  return await Project.findByIdAndUpdate(
    projectId,
    { $addToSet: { promptGroupIds: { $each: promptGroupIds } } },
    { new: true },
  );
};

/**
 * Remove an array of prompt group IDs from a project's promptGroupIds array.
 *
 * @param {string} projectId - The ID of the project to update.
 * @param {string[]} promptGroupIds - The array of prompt group IDs to remove from the project.
 * @returns {Promise<IMongoProject>} The updated project document.
 */
const removeGroupIdsFromProject = async function (projectId, promptGroupIds) {
  return await Project.findByIdAndUpdate(
    projectId,
    { $pull: { promptGroupIds: { $in: promptGroupIds } } },
    { new: true },
  );
};

/**
 * Remove a prompt group ID from all projects.
 *
 * @param {string} promptGroupId - The ID of the prompt group to remove from projects.
 * @returns {Promise<void>}
 */
const removeGroupFromAllProjects = async (promptGroupId) => {
  await Project.updateMany({}, { $pull: { promptGroupIds: promptGroupId } });
};

/**
 * Add an array of agent IDs to a project's agentIds array, ensuring uniqueness.
 *
 * @param {string} projectId - The ID of the project to update.
 * @param {string[]} agentIds - The array of agent IDs to add to the project.
 * @returns {Promise<IMongoProject>} The updated project document.
 */
const addAgentIdsToProject = async function (projectId, agentIds) {
  return await Project.findByIdAndUpdate(
    projectId,
    { $addToSet: { agentIds: { $each: agentIds } } },
    { new: true },
  );
};

/**
 * Remove an array of agent IDs from a project's agentIds array.
 *
 * @param {string} projectId - The ID of the project to update.
 * @param {string[]} agentIds - The array of agent IDs to remove from the project.
 * @returns {Promise<IMongoProject>} The updated project document.
 */
const removeAgentIdsFromProject = async function (projectId, agentIds) {
  return await Project.findByIdAndUpdate(
    projectId,
    { $pull: { agentIds: { $in: agentIds } } },
    { new: true },
  );
};

/**
 * Remove an agent ID from all projects.
 *
 * @param {string} agentId - The ID of the agent to remove from projects.
 * @returns {Promise<void>}
 */
const removeAgentFromAllProjects = async (agentId) => {
  await Project.updateMany({}, { $pull: { agentIds: agentId } });
};

module.exports = {
  getProjectById,
  getProjectByName,
  createUserProject,
  getUserProjects,
  getUserProject,
  updateUserProject,
  deleteUserProject,
  addConversationIdToProject,
  getProjectFiles,
  addProjectFiles,
  removeProjectFile,
  /* prompts */
  addGroupIdsToProject,
  removeGroupIdsFromProject,
  removeGroupFromAllProjects,
  /* agents */
  addAgentIdsToProject,
  removeAgentIdsFromProject,
  removeAgentFromAllProjects,
};
