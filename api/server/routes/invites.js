const express = require('express');
const { requireJwtAuth, checkAdmin } = require('~/server/middleware');
const {
  createAndSendInvite,
  listInvites,
  resendInvite,
  revokeInvite,
} = require('~/server/services/InviteService');

const router = express.Router();

router.use(requireJwtAuth);
router.use(checkAdmin);

router.get('/', async (req, res) => {
  try {
    const invites = await listInvites({ status: req.query.status });
    return res.status(200).json(invites);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post('/', async (req, res) => {
  const email = req.body?.email?.trim()?.toLowerCase();

  if (!email || !email.includes('@')) {
    return res.status(400).json({ message: 'A valid email is required.' });
  }

  try {
    const result = await createAndSendInvite({
      email,
      inviter: req.user?._id ?? null,
      forceEmail: true,
    });

    return res.status(201).json({
      message: result.emailEnabled
        ? 'Invitation sent successfully.'
        : 'Invite created successfully. Email is not configured.',
      inviteLink: result.emailEnabled ? undefined : result.inviteLink,
      emailEnabled: result.emailEnabled,
    });
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message });
  }
});

router.post('/:inviteId/resend', async (req, res) => {
  try {
    const result = await resendInvite({
      inviteId: req.params.inviteId,
      inviter: req.user?._id ?? null,
      forceEmail: true,
    });

    return res.status(200).json({
      message: result.emailEnabled
        ? 'Invitation resent successfully.'
        : 'Invite recreated successfully. Email is not configured.',
      inviteLink: result.emailEnabled ? undefined : result.inviteLink,
      emailEnabled: result.emailEnabled,
    });
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message });
  }
});

router.post('/:inviteId/revoke', async (req, res) => {
  try {
    const invite = await revokeInvite(req.params.inviteId);
    if (!invite) {
      return res.status(404).json({ message: 'Invite not found' });
    }

    return res.status(200).json(invite);
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message });
  }
});

module.exports = router;
