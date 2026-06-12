const { countUsers } = require('~/models');
const {
  canRegisterWithoutInvite,
  getRestrictedRegistrationMessage,
} = require('~/server/services/RegistrationPolicy');

async function validateRegistration(req, res, next) {
  if (req.invite) {
    return next();
  }

  const userCount = await countUsers();
  if (canRegisterWithoutInvite({ userCount })) {
    return next();
  }

  return res.status(403).json({
    message: getRestrictedRegistrationMessage(),
  });
}

module.exports = validateRegistration;
