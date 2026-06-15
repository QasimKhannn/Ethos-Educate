// cowork — CRUD for Cowork projects (separate collection; does not touch Project).
const { CoworkProject } = require('~/db/models');

const MAX_NAME = 128;
const MAX_DESCRIPTION = 2048;
const MAX_INSTRUCTIONS = 8000;

const normalizeText = (value, maxLength) => {
  if (typeof value !== 'string') {
    return undefined;
  }
  return value.trim().slice(0, maxLength);
};

const ownerFilter = (user, projectId) => ({ _id: projectId, user });

const createCoworkProject = async ({ user, name, description = '', instructions = '' }) => {
  const normalizedName = normalizeText(name, MAX_NAME);
  if (!normalizedName) {
    throw new Error('Project name is required');
  }
  const doc = await CoworkProject.create({
    user,
    name: normalizedName,
    description: normalizeText(description, MAX_DESCRIPTION) ?? '',
    instructions: normalizeText(instructions, MAX_INSTRUCTIONS) ?? '',
  });
  return doc.toObject();
};

const getUserCoworkProjects = async (user) => {
  return CoworkProject.find({ user, archived: { $ne: true } })
    .sort({ updatedAt: -1 })
    .lean();
};

const getUserCoworkProject = async ({ user, projectId }) => {
  return CoworkProject.findOne(ownerFilter(user, projectId)).lean();
};

const updateCoworkProject = async ({
  user,
  projectId,
  name,
  description,
  instructions,
  enabledSkills,
}) => {
  const $set = {};
  const normalizedName = normalizeText(name, MAX_NAME);
  if (normalizedName !== undefined) {
    if (!normalizedName) {
      throw new Error('Project name is required');
    }
    $set.name = normalizedName;
  }
  const normalizedDescription = normalizeText(description, MAX_DESCRIPTION);
  if (normalizedDescription !== undefined) {
    $set.description = normalizedDescription;
  }
  const normalizedInstructions = normalizeText(instructions, MAX_INSTRUCTIONS);
  if (normalizedInstructions !== undefined) {
    $set.instructions = normalizedInstructions;
  }
  if (Array.isArray(enabledSkills)) {
    $set.enabledSkills = [...new Set(enabledSkills.filter((s) => typeof s === 'string' && s.trim()))];
  }

  return CoworkProject.findOneAndUpdate(ownerFilter(user, projectId), { $set }, { new: true }).lean();
};

const deleteCoworkProject = async ({ user, projectId }) => {
  return CoworkProject.findOneAndDelete(ownerFilter(user, projectId)).lean();
};

module.exports = {
  createCoworkProject,
  getUserCoworkProjects,
  getUserCoworkProject,
  updateCoworkProject,
  deleteCoworkProject,
};
