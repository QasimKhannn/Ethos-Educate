const { isEnabled } = require('@librechat/api');
const {
  getAdminConfig,
  normalizeAllowedDomains,
  updateAllowedDomains,
} = require('~/models/adminConfig');
const { getAppConfig } = require('~/server/services/Config');
const {
  canRegisterWithoutInvite,
  isInviteOnlyRegistrationEnabled,
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

const getRegistrationPolicySnapshot = async ({ userCount = 0 } = {}) => {
  const allowedDomains = await getEffectiveAllowedDomains();

  return {
    inviteOnlyRegistration: isInviteOnlyRegistrationEnabled(),
    publicRegistrationEnabled: canRegisterWithoutInvite({ userCount }),
    allowUnverifiedEmailLogin: isEnabled(process.env.ALLOW_UNVERIFIED_EMAIL_LOGIN),
    allowedDomains,
  };
};

module.exports = {
  getEffectiveAllowedDomains,
  getRegistrationPolicySnapshot,
  updateAllowedDomains,
};
