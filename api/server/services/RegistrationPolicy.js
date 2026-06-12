const { isEnabled } = require('@librechat/api');

const getRestrictedRegistrationMessage = () =>
  'Account access is restricted. Please contact your administrator for an invite.';

const isInviteOnlyRegistrationEnabled = () => isEnabled(process.env.INVITE_ONLY_REGISTRATION);

const isPublicRegistrationEnabled = () =>
  !isInviteOnlyRegistrationEnabled() && isEnabled(process.env.ALLOW_REGISTRATION);

const allowFirstUserAdminBootstrap = () =>
  process.env.NODE_ENV !== 'production' || isEnabled(process.env.ALLOW_FIRST_USER_ADMIN);

const shouldAutoAssignFirstAdmin = ({ userCount = 0 } = {}) =>
  userCount === 0 && allowFirstUserAdminBootstrap();

const canRegisterWithoutInvite = ({ userCount = 0 } = {}) =>
  shouldAutoAssignFirstAdmin({ userCount }) || isPublicRegistrationEnabled();

const canCreateAccount = ({ userCount = 0, hasInvite = false } = {}) =>
  hasInvite || canRegisterWithoutInvite({ userCount });

module.exports = {
  canCreateAccount,
  canRegisterWithoutInvite,
  getRestrictedRegistrationMessage,
  isInviteOnlyRegistrationEnabled,
  shouldAutoAssignFirstAdmin,
};
