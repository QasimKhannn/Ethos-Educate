const { countUsers } = require('~/models');
const { getRestrictedRegistrationMessage } = require('~/server/services/RegistrationPolicy');
const { canRegisterWithoutInviteEffective } = require('~/server/services/AdminConfigService');

async function validateRegistration(req, res, next) {
  if (req.invite) {
    return next();
  }

  const userCount = await countUsers();
  if (await canRegisterWithoutInviteEffective({ userCount })) {
    return next();
  }

  return res.status(403).json({
    message: getRestrictedRegistrationMessage(),
  });
}

module.exports = validateRegistration;
