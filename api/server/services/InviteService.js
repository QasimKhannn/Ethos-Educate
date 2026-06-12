const { checkEmailConfig } = require('@librechat/api');
const { findUser } = require('~/models');
const { sendEmail } = require('~/server/utils');
const {
  createInvite,
  listInvites,
  revokeInvite,
  getInviteById,
} = require('~/models/inviteUser');

const buildInviteLink = (token) => `${process.env.DOMAIN_CLIENT}/register?token=${token}`;

const sendInviteEmail = async ({ email, inviteLink }) => {
  const appName = process.env.APP_TITLE || 'Enterprise Chat';

  await sendEmail({
    email,
    subject: `Invite to join ${appName}!`,
    payload: {
      appName,
      inviteLink,
      year: new Date().getFullYear(),
    },
    template: 'inviteUser.handlebars',
  });
};

const createAndSendInvite = async ({ email, inviter = null, forceEmail = true }) => {
  const existingUser = await findUser({ email }, 'email _id');
  if (existingUser) {
    const error = new Error('A user with that email already exists.');
    error.status = 400;
    throw error;
  }

  const token = await createInvite(email, inviter);
  const inviteLink = buildInviteLink(token);
  const emailEnabled = checkEmailConfig();

  if (forceEmail && emailEnabled) {
    await sendInviteEmail({ email, inviteLink });
  }

  return {
    emailEnabled,
    inviteLink,
    token,
  };
};

const resendInvite = async ({ inviteId, inviter = null, forceEmail = true }) => {
  const invite = await getInviteById(inviteId);
  if (!invite) {
    const error = new Error('Invite not found');
    error.status = 404;
    throw error;
  }

  if (invite.status === 'accepted') {
    const error = new Error('Accepted invites cannot be resent');
    error.status = 400;
    throw error;
  }

  if (invite.status === 'revoked') {
    const error = new Error('Revoked invites cannot be resent');
    error.status = 400;
    throw error;
  }

  return createAndSendInvite({
    email: invite.email,
    inviter: inviter ?? invite.inviter ?? null,
    forceEmail,
  });
};

module.exports = {
  buildInviteLink,
  createAndSendInvite,
  listInvites,
  resendInvite,
  revokeInvite,
};
