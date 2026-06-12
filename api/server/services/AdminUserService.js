const { SystemRoles } = require('librechat-data-provider');
const { User, Invite } = require('~/db/models');
const { deleteAllUserSessions, updateUser } = require('~/models');
const {
  ensureUserMembership,
  isUserActive,
  listMembershipsByUserIds,
  setUserMembershipStatus,
} = require('~/models/userMembership');
const { getRegistrationPolicySnapshot } = require('./AdminConfigService');

const ACTIVE_STATUS = 'active';
const INACTIVE_STATUS = 'inactive';

const buildMembershipMap = (memberships = []) => {
  const map = new Map();
  for (const membership of memberships) {
    map.set(String(membership.user), membership);
  }
  return map;
};

const getMembershipState = (membership) => {
  if (!membership) {
    return {
      status: ACTIVE_STATUS,
      deactivatedAt: null,
      deactivatedBy: null,
    };
  }

  return {
    status: membership.status ?? ACTIVE_STATUS,
    deactivatedAt: membership.deactivatedAt ?? null,
    deactivatedBy: membership.deactivatedBy ?? null,
  };
};

const getLatestInviteMaps = async (users = []) => {
  const emails = users.map((user) => user.email).filter(Boolean);
  const userIds = users.map((user) => user._id);

  const invites = await Invite.find({
    $or: [{ email: { $in: emails } }, { acceptedUser: { $in: userIds } }],
  })
    .sort({ createdAt: -1 })
    .lean();

  const inviteByEmail = new Map();
  const inviteByAcceptedUser = new Map();

  for (const invite of invites) {
    if (invite.email && !inviteByEmail.has(invite.email)) {
      inviteByEmail.set(invite.email, invite);
    }

    if (invite.acceptedUser && !inviteByAcceptedUser.has(String(invite.acceptedUser))) {
      inviteByAcceptedUser.set(String(invite.acceptedUser), invite);
    }
  }

  return { inviteByAcceptedUser, inviteByEmail };
};

const countActiveAdmins = async ({ excludeUserId } = {}) => {
  const admins = await User.find({ role: SystemRoles.ADMIN }, '_id role').lean();
  const adminIds = admins.map((admin) => admin._id);
  const membershipMap = buildMembershipMap(await listMembershipsByUserIds(adminIds));

  return admins.filter((admin) => {
    if (excludeUserId && String(admin._id) === String(excludeUserId)) {
      return false;
    }

    const membership = membershipMap.get(String(admin._id));
    return !membership || membership.status !== INACTIVE_STATUS;
  }).length;
};

const listUsersWithAdminState = async () => {
  const users = await User.find({}, '-password -__v -totpSecret -backupCodes -backupCodeHashes')
    .sort({ createdAt: -1 })
    .lean();

  const userIds = users.map((user) => user._id);
  const membershipMap = buildMembershipMap(await listMembershipsByUserIds(userIds));
  const { inviteByAcceptedUser, inviteByEmail } = await getLatestInviteMaps(users);

  return users.map((user) => {
    const membership = getMembershipState(membershipMap.get(String(user._id)));
    const invite = inviteByAcceptedUser.get(String(user._id)) ?? inviteByEmail.get(user.email);

    return {
      ...user,
      membership,
      invite: invite
        ? {
            id: invite._id,
            status: invite.status,
            createdAt: invite.createdAt,
            expiresAt: invite.expiresAt,
            acceptedAt: invite.acceptedAt ?? null,
            revokedAt: invite.revokedAt ?? null,
          }
        : null,
    };
  });
};

const getAdminOverview = async () => {
  const users = await listUsersWithAdminState();
  const policy = await getRegistrationPolicySnapshot({ userCount: users.length });
  const inviteCounts = await Invite.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);

  const inviteMap = inviteCounts.reduce((acc, item) => {
    acc[item._id] = item.count;
    return acc;
  }, {});

  return {
    counts: {
      totalUsers: users.length,
      activeUsers: users.filter((user) => user.membership.status === ACTIVE_STATUS).length,
      inactiveUsers: users.filter((user) => user.membership.status === INACTIVE_STATUS).length,
      adminUsers: users.filter((user) => user.role === SystemRoles.ADMIN).length,
      pendingInvites: inviteMap.pending ?? 0,
      acceptedInvites: inviteMap.accepted ?? 0,
      revokedInvites: inviteMap.revoked ?? 0,
      expiredInvites: inviteMap.expired ?? 0,
    },
    policy,
  };
};

const updateManagedUserStatus = async ({ targetUserId, status, actorUserId }) => {
  const user = await User.findById(targetUserId).lean();
  if (!user) {
    const error = new Error('User not found');
    error.status = 404;
    throw error;
  }

  if (String(targetUserId) === String(actorUserId) && status === INACTIVE_STATUS) {
    const error = new Error('You cannot deactivate your own account.');
    error.status = 400;
    throw error;
  }

  if (user.role === SystemRoles.ADMIN && status === INACTIVE_STATUS) {
    const remainingActiveAdmins = await countActiveAdmins({ excludeUserId: targetUserId });
    if (remainingActiveAdmins === 0) {
      const error = new Error('At least one active admin account must remain.');
      error.status = 400;
      throw error;
    }
  }

  const membership = await setUserMembershipStatus({
    userId: targetUserId,
    status,
    actedBy: actorUserId,
  });

  if (status === INACTIVE_STATUS) {
    await deleteAllUserSessions({ userId: targetUserId });
  }

  return membership;
};

const updateManagedUserRole = async ({ targetUserId, role, actorUserId }) => {
  const normalizedRole = String(role ?? '').toUpperCase();
  const user = await User.findById(targetUserId).lean();

  if (!user) {
    const error = new Error('User not found');
    error.status = 404;
    throw error;
  }

  if (![SystemRoles.ADMIN, SystemRoles.USER].includes(normalizedRole)) {
    const error = new Error('Invalid role');
    error.status = 400;
    throw error;
  }

  if (String(targetUserId) === String(actorUserId) && normalizedRole !== user.role) {
    const error = new Error('You cannot change your own role.');
    error.status = 400;
    throw error;
  }

  if (user.role === SystemRoles.ADMIN && normalizedRole !== SystemRoles.ADMIN) {
    const remainingActiveAdmins = await countActiveAdmins({ excludeUserId: targetUserId });
    if (remainingActiveAdmins === 0) {
      const error = new Error('At least one active admin account must remain.');
      error.status = 400;
      throw error;
    }
  }

  await updateUser(targetUserId, { role: normalizedRole });
  await ensureUserMembership(targetUserId);

  return User.findById(targetUserId, '-password -__v -totpSecret -backupCodes').lean();
};

module.exports = {
  ACTIVE_STATUS,
  INACTIVE_STATUS,
  getAdminOverview,
  isUserActive,
  listUsersWithAdminState,
  updateManagedUserRole,
  updateManagedUserStatus,
};
