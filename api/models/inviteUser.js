const { logger, hashToken, getRandomValues } = require('@librechat/data-schemas');
const { Invite } = require('~/db/models');

/**
 * @module inviteUser
 * @description This module provides functions to create and get user invites
 */

const normalizeEmail = (email) => email.trim().toLowerCase();

const expireInviteIfNeeded = async (invite) => {
  if (!invite || invite.status !== 'pending') {
    return invite;
  }

  if (invite.expiresAt > new Date()) {
    return invite;
  }

  invite.status = 'expired';
  await invite.save();
  return invite;
};

/**
 * @function createInvite
 * @description This function creates a new user invite
 * @param {string} email - The email of the user to invite
 * @returns {Promise<Object>} A promise that resolves to the saved invite document
 * @throws {Error} If there is an error creating the invite
 */
const createInvite = async (email, inviter = null) => {
  try {
    const normalizedEmail = normalizeEmail(email);
    const token = await getRandomValues(32);
    const hash = await hashToken(token);
    const encodedToken = encodeURIComponent(token);
    const expiresAt = new Date(Date.now() + 604800 * 1000);

    await Invite.updateMany(
      { email: normalizedEmail, status: 'pending' },
      { status: 'revoked', revokedAt: new Date() },
    );

    await Invite.create({
      email: normalizedEmail,
      token: hash,
      inviter,
      expiresAt,
    });

    return encodedToken;
  } catch (error) {
    logger.error('[createInvite] Error creating invite', error);
    return { message: 'Error creating invite' };
  }
};

/**
 * @function getInvite
 * @description This function retrieves a user invite
 * @param {string} encodedToken - The token of the invite to retrieve
 * @param {string} email - The email of the user to validate
 * @returns {Promise<Object>} A promise that resolves to the retrieved invite document
 * @throws {Error} If there is an error retrieving the invite, if the invite does not exist, or if the email does not match
 */
const getInvite = async (encodedToken, email) => {
  try {
    const token = decodeURIComponent(encodedToken);
    const hash = await hashToken(token);
    const normalizedEmail = normalizeEmail(email);
    const invite = await Invite.findOne({ token: hash, email: normalizedEmail });

    if (!invite) {
      throw new Error('Invite not found or email does not match');
    }

    await expireInviteIfNeeded(invite);

    if (invite.status !== 'pending') {
      throw new Error('Invite is no longer active');
    }

    return invite;
  } catch (error) {
    logger.error('[getInvite] Error getting invite:', error);
    return { error: true, message: error.message };
  }
};

const markInviteAccepted = async (inviteId, userId) => {
  try {
    await Invite.findByIdAndUpdate(inviteId, {
      status: 'accepted',
      acceptedUser: userId,
      acceptedAt: new Date(),
    });
  } catch (error) {
    logger.error('[markInviteAccepted] Error accepting invite:', error);
    throw error;
  }
};

const listInvites = async ({ status } = {}) => {
  const query = status ? { status } : {};
  return Invite.find(query)
    .sort({ createdAt: -1 })
    .populate('inviter', 'email name username')
    .populate('acceptedUser', 'email name username')
    .lean();
};

const revokeInvite = async (inviteId) => {
  const invite = await Invite.findById(inviteId);
  if (!invite) {
    return null;
  }

  if (invite.status === 'accepted') {
    return invite;
  }

  invite.status = 'revoked';
  invite.revokedAt = new Date();
  await invite.save();
  return invite;
};

const getInviteById = async (inviteId) => Invite.findById(inviteId);

module.exports = {
  createInvite,
  getInvite,
  getInviteById,
  listInvites,
  markInviteAccepted,
  revokeInvite,
};
