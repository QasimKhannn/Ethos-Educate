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

const updateAllowedDomains = async (domains = []) =>
  AdminConfig.findOneAndUpdate(
    { key: 'global' },
    { $set: { allowedDomains: normalizeAllowedDomains(domains) } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();

module.exports = {
  getAdminConfig,
  normalizeAllowedDomains,
  updateAllowedDomains,
};
