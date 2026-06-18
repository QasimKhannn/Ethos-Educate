// cowork — CRUD for Cowork projects (separate collection; does not touch Project).
const { CoworkProject, Conversation, Message } = require('~/db/models');

const MESSAGES_PAGE = 25;

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

const MAX_MODEL = 128;
const MAX_PROVIDER = 64;

const updateCoworkProject = async ({
  user,
  projectId,
  name,
  description,
  instructions,
  enabledSkills,
  enabledConnectors,
  model,
  provider,
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
  if (Array.isArray(enabledConnectors)) {
    $set.enabledConnectors = [
      ...new Set(enabledConnectors.filter((s) => typeof s === 'string' && s.trim())),
    ];
  }
  const normalizedModel = normalizeText(model, MAX_MODEL);
  if (normalizedModel !== undefined) {
    $set.model = normalizedModel || undefined;
  }
  const normalizedProvider = normalizeText(provider, MAX_PROVIDER);
  if (normalizedProvider !== undefined) {
    $set.provider = normalizedProvider || undefined;
  }

  return CoworkProject.findOneAndUpdate(ownerFilter(user, projectId), { $set }, { new: true }).lean();
};

const deleteCoworkProject = async ({ user, projectId }) => {
  return CoworkProject.findOneAndDelete(ownerFilter(user, projectId)).lean();
};

/**
 * Remove a conversation from a Cowork project (owner-scoped).
 * Only unlinks it from the project's conversationIds array — message/conversation
 * document cleanup is handled asynchronously by the route after responding.
 * Returns the updated project doc, or null if project/ownership mismatch.
 */
const removeCoworkConversation = async ({ user, projectId, conversationId }) => {
  if (!conversationId) {
    throw new Error('conversationId is required');
  }
  return CoworkProject.findOneAndUpdate(
    ownerFilter(user, projectId),
    { $pull: { conversationIds: conversationId } },
    { new: true },
  ).lean();
};

/** Link a conversation to a Cowork project (idempotent; owner-scoped). */
const addCoworkProjectConversation = async ({ user, projectId, conversationId }) => {
  if (!conversationId) {
    throw new Error('conversationId is required');
  }
  return CoworkProject.findOneAndUpdate(
    ownerFilter(user, projectId),
    { $addToSet: { conversationIds: conversationId } },
    { new: true },
  ).lean();
};

/**
 * Reverse lookup: find the Cowork project a conversation belongs to (owner-scoped).
 * Used by the execution bridge to resolve the workspace from the active conversation.
 */
const getCoworkProjectByConversation = async ({ user, conversationId }) => {
  if (!conversationId) {
    return null;
  }
  return CoworkProject.findOne({ user, conversationIds: conversationId }).lean();
};

/**
 * List a project's linked conversations with metadata (title + recency), most
 * recent first. Owner-scoped on both the project and the conversations. Returns
 * `null` if the project doesn't exist for this user.
 */
const getCoworkProjectConversations = async ({ user, projectId }) => {
  const project = await CoworkProject.findOne(ownerFilter(user, projectId))
    .select('conversationIds')
    .lean();
  if (!project) {
    return null;
  }
  const ids = Array.isArray(project.conversationIds) ? project.conversationIds : [];
  if (ids.length === 0) {
    return [];
  }
  const convos = await Conversation.find({ user, conversationId: { $in: ids } })
    .select('conversationId title updatedAt')
    .sort({ updatedAt: -1 })
    .lean();
  return convos.map((c) => ({
    conversationId: c.conversationId,
    title: c.title || 'New chat',
    updatedAt: c.updatedAt,
  }));
};

/**
 * Page a conversation's messages, newest-first cursor (`before` = ISO createdAt).
 * Owner-scoped: the project must belong to the user and link this conversation.
 * Returns messages in chronological (ascending) order for easy prepend, plus a
 * `nextBefore` cursor and `hasMore`. Returns `null` if access is denied.
 */
const getCoworkConversationMessages = async ({ user, projectId, conversationId, limit, before }) => {
  const project = await CoworkProject.findOne({
    ...ownerFilter(user, projectId),
    conversationIds: conversationId,
  })
    .select('_id')
    .lean();
  if (!project) {
    return null;
  }

  const pageSize = Math.min(Math.max(Number(limit) || MESSAGES_PAGE, 1), 100);
  const query = { user, conversationId };
  if (before) {
    const beforeDate = new Date(before);
    if (!Number.isNaN(beforeDate.getTime())) {
      query.createdAt = { $lt: beforeDate };
    }
  }

  // Fetch newest-first with one extra to detect whether older pages remain.
  const docs = await Message.find(query)
    .select('messageId parentMessageId isCreatedByUser text content createdAt')
    .sort({ createdAt: -1 })
    .limit(pageSize + 1)
    .lean();

  const hasMore = docs.length > pageSize;
  const page = hasMore ? docs.slice(0, pageSize) : docs;
  // page is newest-first → its last element is the oldest in this page (next cursor).
  const nextBefore = page.length > 0 ? page[page.length - 1].createdAt : undefined;

  return {
    messages: page
      .slice()
      .reverse()
      .map((m) => ({
        messageId: m.messageId,
        parentMessageId: m.parentMessageId ?? null,
        isCreatedByUser: !!m.isCreatedByUser,
        text: m.text || '',
        content: m.content,
        createdAt: m.createdAt,
      })),
    hasMore,
    nextBefore,
  };
};

module.exports = {
  createCoworkProject,
  getUserCoworkProjects,
  getUserCoworkProject,
  updateCoworkProject,
  deleteCoworkProject,
  addCoworkProjectConversation,
  removeCoworkConversation,
  getCoworkProjectByConversation,
  getCoworkProjectConversations,
  getCoworkConversationMessages,
};
