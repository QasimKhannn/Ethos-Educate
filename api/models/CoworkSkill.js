// cowork — Phase A / A2. CRUD for per-user CUSTOM skills (markdown instructions the
// coworker follows). Separate collection; ownership-scoped by `user` exactly like
// CoworkProject / CoworkRoutine. Built-in skills are unaffected (they live on disk).
const { Types } = require('mongoose');
const { CoworkSkill } = require('~/db/models');

const MAX_NAME = 128;
const MAX_DESC = 512;
const MAX_CONTENT = 20000;

const intFromEnv = (key, fallback) => {
  const n = parseInt(process.env[key] || '', 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};
const MAX_PER_USER = intFromEnv('COWORK_SKILLS_MAX_PER_USER', 50);

const normalizeText = (value, maxLength) => {
  if (typeof value !== 'string') {
    return undefined;
  }
  return value.trim().slice(0, maxLength);
};

const ownerFilter = (user, skillId) => ({ _id: skillId, user });

/** Create a custom skill for a user. Enforces required fields + a per-user quota. */
const createCoworkSkill = async ({ user, name, description, content }) => {
  const normalizedName = normalizeText(name, MAX_NAME);
  if (!normalizedName) {
    throw new Error('Skill name is required');
  }
  const normalizedContent = normalizeText(content, MAX_CONTENT);
  if (!normalizedContent) {
    throw new Error('Skill instructions are required');
  }

  const existingCount = await CoworkSkill.countDocuments({ user });
  if (existingCount >= MAX_PER_USER) {
    throw new Error(
      `Custom skill limit reached (${MAX_PER_USER}). Delete a skill before adding another.`,
    );
  }

  const doc = await CoworkSkill.create({
    user,
    name: normalizedName,
    description: normalizeText(description, MAX_DESC) || '',
    content: normalizedContent,
    source: 'custom',
  });
  return doc.toObject();
};

/** All custom skills owned by a user, newest first. */
const getUserCoworkSkills = async ({ user }) => {
  return CoworkSkill.find({ user }).sort({ updatedAt: -1 }).lean();
};

/** One custom skill (with content) by id, ownership-scoped. Null on bad id / not found. */
const getCoworkSkill = async ({ user, skillId }) => {
  if (!Types.ObjectId.isValid(skillId)) {
    return null;
  }
  return CoworkSkill.findOne(ownerFilter(user, skillId)).lean();
};

/** Delete a custom skill by id, ownership-scoped. Null on bad id / not found. */
const deleteCoworkSkill = async ({ user, skillId }) => {
  if (!Types.ObjectId.isValid(skillId)) {
    return null;
  }
  return CoworkSkill.findOneAndDelete(ownerFilter(user, skillId)).lean();
};

module.exports = {
  createCoworkSkill,
  getUserCoworkSkills,
  getCoworkSkill,
  deleteCoworkSkill,
};
