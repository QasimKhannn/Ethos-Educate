const express = require('express');
const { requireJwtAuth, checkAdmin } = require('~/server/middleware');
const { logAdminAction } = require('~/server/services/AdminAuditService');
const {
  AUTH_MODES,
  getOpenIdAdminStatus,
  updateOpenIdConfig,
  updateAuthMode,
  validateOpenIdDiscovery,
} = require('~/server/services/SsoConfigService');

const router = express.Router();

router.use(requireJwtAuth);
router.use(checkAdmin);

/** Current SSO status (masked — never returns the client secret). */
router.get('/', async (_req, res) => {
  try {
    const status = await getOpenIdAdminStatus();
    return res.status(200).json(status);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

/**
 * Update OpenID config.
 * Body: { enabled?, fields?, secretAction?: 'replace'|'keep'|'clear', clientSecret? }
 * The raw secret is never logged or returned.
 */
router.put('/openid', async (req, res) => {
  const { fields, secretAction = 'keep', clientSecret, enabled } = req.body ?? {};

  if (!['replace', 'keep', 'clear'].includes(secretAction)) {
    return res.status(400).json({ message: 'secretAction must be replace, keep, or clear.' });
  }

  try {
    const status = await updateOpenIdConfig({ fields, secretAction, clientSecret, enabled });

    await logAdminAction({
      actorUserId: req.user?._id ?? null,
      action: 'sso_openid_updated',
      targetType: 'sso',
      targetId: 'openid',
      details: {
        enabled: status.enabled,
        secretAction,
        fields: fields && typeof fields === 'object' ? Object.keys(fields) : [],
      },
    });

    return res.status(200).json(status);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

/** Update auth mode: local_only | local_and_sso | sso_only. */
router.put('/auth-mode', async (req, res) => {
  const authMode = String(req.body?.authMode ?? '');

  if (!AUTH_MODES.includes(authMode)) {
    return res.status(400).json({ message: 'A valid authMode is required.' });
  }

  try {
    const result = await updateAuthMode(authMode);

    await logAdminAction({
      actorUserId: req.user?._id ?? null,
      action: 'sso_auth_mode_changed',
      targetType: 'sso',
      targetId: 'authMode',
      details: { authMode: result },
    });

    return res.status(200).json({ authMode: result });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

/** Validate an OpenID issuer's discovery document (read-only test button). */
router.post('/openid/validate', async (req, res) => {
  try {
    const result = await validateOpenIdDiscovery(req.body?.issuer);

    await logAdminAction({
      actorUserId: req.user?._id ?? null,
      action: 'sso_openid_validated',
      targetType: 'sso',
      targetId: 'openid',
      details: { ok: result.ok, error: result.error ?? null },
    });

    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

module.exports = router;
