const { isEnabled } = require('@librechat/api');
const { SystemRoles } = require('librechat-data-provider');
const {
  getAdminConfig,
  normalizeAllowedDomains,
  updateAdminConfig,
  updateAllowedDomains,
} = require('~/models/adminConfig');
const { getAppConfig } = require('~/server/services/Config');
const {
  isInviteOnlyRegistrationEnabled,
  shouldAutoAssignFirstAdmin,
} = require('~/server/services/RegistrationPolicy');

const getEffectiveAllowedDomains = async () => {
  const appConfig = await getAppConfig();
  const yamlDomains = normalizeAllowedDomains(appConfig?.registration?.allowedDomains ?? []);
  const adminConfig = await getAdminConfig();

  if (Array.isArray(adminConfig?.allowedDomains)) {
    return normalizeAllowedDomains(adminConfig.allowedDomains);
  }

  return yamlDomains;
};

const getEffectiveInviteOnlyRegistration = async () => {
  const adminConfig = await getAdminConfig();

  if (typeof adminConfig?.inviteOnlyRegistration === 'boolean') {
    return adminConfig.inviteOnlyRegistration;
  }

  return isInviteOnlyRegistrationEnabled();
};

const canRegisterWithoutInviteEffective = async ({ userCount = 0 } = {}) => {
  if (shouldAutoAssignFirstAdmin({ userCount })) {
    return true;
  }

  const inviteOnlyRegistration = await getEffectiveInviteOnlyRegistration();
  return !inviteOnlyRegistration && isEnabled(process.env.ALLOW_REGISTRATION);
};

const canCreateAccountEffective = async ({ userCount = 0, hasInvite = false } = {}) =>
  hasInvite || (await canRegisterWithoutInviteEffective({ userCount }));

const updateRegistrationPolicy = async ({ allowedDomains, inviteOnlyRegistration } = {}) => {
  const updates = {};

  if (allowedDomains !== undefined) {
    updates.allowedDomains = normalizeAllowedDomains(allowedDomains);
  }

  if (inviteOnlyRegistration !== undefined) {
    updates.inviteOnlyRegistration = Boolean(inviteOnlyRegistration);
  }

  if (Object.keys(updates).length === 0) {
    return getAdminConfig();
  }

  return updateAdminConfig(updates);
};

const getRegistrationPolicySnapshot = async ({ userCount = 0 } = {}) => {
  const [allowedDomains, inviteOnlyRegistration, publicRegistrationEnabled] = await Promise.all([
    getEffectiveAllowedDomains(),
    getEffectiveInviteOnlyRegistration(),
    canRegisterWithoutInviteEffective({ userCount }),
  ]);

  return {
    inviteOnlyRegistration,
    publicRegistrationEnabled,
    allowUnverifiedEmailLogin: isEnabled(process.env.ALLOW_UNVERIFIED_EMAIL_LOGIN),
    allowedDomains,
  };
};

/* cowork — access policy (who may use the Cowork section). Safe defaults keep Cowork open. */

const COWORK_ACCESS_DEFAULTS = { enabled: true, mode: 'everyone', grantedUserIds: [] };

/** Read the effective Cowork access policy (with defaults applied). */
const getCoworkAccessPolicy = async () => {
  const adminConfig = await getAdminConfig();
  const cowork = adminConfig?.cowork || {};
  return {
    enabled: typeof cowork.enabled === 'boolean' ? cowork.enabled : COWORK_ACCESS_DEFAULTS.enabled,
    mode: cowork.mode === 'allowlist' ? 'allowlist' : 'everyone',
    grantedUserIds: Array.isArray(cowork.grantedUserIds) ? cowork.grantedUserIds.map(String) : [],
  };
};

/** Whether a given user may use Cowork under a policy. Admins always may. */
const canUseCowork = (user, policy) => {
  if (!user) {
    return false;
  }
  if (user.role === SystemRoles.ADMIN) {
    return true;
  }
  if (!policy.enabled) {
    return false;
  }
  if (policy.mode === 'allowlist') {
    return policy.grantedUserIds.includes(String(user.id || user._id));
  }
  return true;
};

/** Update the global enable flag and/or access mode. */
const updateCoworkAccess = async ({ enabled, mode } = {}) => {
  const updates = {};
  if (typeof enabled === 'boolean') {
    updates['cowork.enabled'] = enabled;
  }
  if (mode === 'everyone' || mode === 'allowlist') {
    updates['cowork.mode'] = mode;
  }
  if (Object.keys(updates).length > 0) {
    await updateAdminConfig(updates);
  }
  return getCoworkAccessPolicy();
};

/** Grant a single user Cowork access (used in allowlist mode). */
const grantCoworkUser = async (userId) => {
  const policy = await getCoworkAccessPolicy();
  const next = [...new Set([...policy.grantedUserIds, String(userId)])];
  await updateAdminConfig({ 'cowork.grantedUserIds': next });
  return getCoworkAccessPolicy();
};

/** Revoke a single user's Cowork grant. */
const revokeCoworkUser = async (userId) => {
  const policy = await getCoworkAccessPolicy();
  const next = policy.grantedUserIds.filter((id) => id !== String(userId));
  await updateAdminConfig({ 'cowork.grantedUserIds': next });
  return getCoworkAccessPolicy();
};

module.exports = {
  canCreateAccountEffective,
  canRegisterWithoutInviteEffective,
  getEffectiveAllowedDomains,
  getEffectiveInviteOnlyRegistration,
  getRegistrationPolicySnapshot,
  updateAllowedDomains,
  updateRegistrationPolicy,
  getCoworkAccessPolicy,
  canUseCowork,
  updateCoworkAccess,
  grantCoworkUser,
  revokeCoworkUser,
};

