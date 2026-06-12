const { UserMembership } = require('~/db/models');

const ensureUserMembership = async (userId) =>
  UserMembership.findOneAndUpdate(
    { user: userId },
    { $setOnInsert: { status: 'active' } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

const getUserMembershipByUserId = async (userId) => UserMembership.findOne({ user: userId }).lean();

const listMembershipsByUserIds = async (userIds = []) =>
  UserMembership.find({ user: { $in: userIds } }).lean();

const setUserMembershipStatus = async ({ userId, status, actedBy = null }) => {
  const update =
    status === 'inactive'
      ? {
          status,
          deactivatedAt: new Date(),
          deactivatedBy: actedBy,
        }
      : {
          status,
          deactivatedAt: null,
          deactivatedBy: null,
        };

  return UserMembership.findOneAndUpdate({ user: userId }, update, {
    upsert: true,
    new: true,
    setDefaultsOnInsert: true,
  }).lean();
};

const isUserActive = async (userId) => {
  const membership = await getUserMembershipByUserId(userId);
  return !membership || membership.status !== 'inactive';
};

module.exports = {
  ensureUserMembership,
  getUserMembershipByUserId,
  isUserActive,
  listMembershipsByUserIds,
  setUserMembershipStatus,
};
