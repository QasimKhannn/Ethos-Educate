const express = require('express');
const { SystemRoles } = require('librechat-data-provider');
const { requireJwtAuth, checkAdmin } = require('~/server/middleware');
const { updateAllowedDomains } = require('~/server/services/AdminConfigService');
const {
  ACTIVE_STATUS,
  INACTIVE_STATUS,
  getAdminOverview,
  listUsersWithAdminState,
  updateManagedUserRole,
  updateManagedUserStatus,
} = require('~/server/services/AdminUserService');

const router = express.Router();

router.use(requireJwtAuth);
router.use(checkAdmin);

router.get('/overview', async (_req, res) => {
  try {
    const overview = await getAdminOverview();
    return res.status(200).json(overview);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.get('/users', async (_req, res) => {
  try {
    const users = await listUsersWithAdminState();
    return res.status(200).json(users);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.patch('/users/:userId/status', async (req, res) => {
  const status = String(req.body?.status ?? '').toLowerCase();

  if (![ACTIVE_STATUS, INACTIVE_STATUS].includes(status)) {
    return res.status(400).json({ message: 'A valid membership status is required.' });
  }

  try {
    const membership = await updateManagedUserStatus({
      targetUserId: req.params.userId,
      status,
      actorUserId: req.user?._id,
    });

    return res.status(200).json(membership);
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message });
  }
});

router.patch('/users/:userId/role', async (req, res) => {
  const role = String(req.body?.role ?? '').toUpperCase();

  if (![SystemRoles.ADMIN, SystemRoles.USER].includes(role)) {
    return res.status(400).json({ message: 'A valid role is required.' });
  }

  try {
    const user = await updateManagedUserRole({
      targetUserId: req.params.userId,
      role,
      actorUserId: req.user?._id,
    });

    return res.status(200).json(user);
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message });
  }
});

router.patch('/registration-policy', async (req, res) => {
  const allowedDomains = Array.isArray(req.body?.allowedDomains) ? req.body.allowedDomains : null;

  if (allowedDomains == null) {
    return res.status(400).json({ message: 'allowedDomains must be an array.' });
  }

  try {
    const config = await updateAllowedDomains(allowedDomains);
    return res.status(200).json({
      allowedDomains: Array.isArray(config.allowedDomains) ? config.allowedDomains : [],
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

module.exports = router;
