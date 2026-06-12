const { AdminConfig } = require('~/db/models');

const normalizeAllowedDomains = (domains = []) => {
  const values = Array.isArray(domains) ? domains : [];

  return [...new Set(values.map((domain) => String(domain).trim().toLowerCase()).filter(Boolean))];
};

const getAdminConfig = async () =>
  AdminConfig.findOneAndUpdate(
    { key: 'global' },
    { $setOnInsert: { key: 'global' } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();

const updateAdminConfig = async (updates = {}) =>
  AdminConfig.findOneAndUpdate(
    { key: 'global' },
    { $set: updates },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();

const updateAllowedDomains = async (domains = []) =>
  updateAdminConfig({ allowedDomains: normalizeAllowedDomains(domains) });

const updateInviteOnlyRegistration = async (inviteOnlyRegistration) =>
  updateAdminConfig({ inviteOnlyRegistration: Boolean(inviteOnlyRegistration) });

module.exports = {
  getAdminConfig,
  normalizeAllowedDomains,
  updateAdminConfig,
  updateAllowedDomains,
  updateInviteOnlyRegistration,
};
