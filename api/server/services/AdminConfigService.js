const { isEnabled } = require('@librechat/api');
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

module.exports = {
  canCreateAccountEffective,
  canRegisterWithoutInviteEffective,
  getEffectiveAllowedDomains,
  getEffectiveInviteOnlyRegistration,
  getRegistrationPolicySnapshot,
  updateAllowedDomains,
  updateRegistrationPolicy,
};

