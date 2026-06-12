const { AdminAuditLog } = require('~/db/models');

const createAdminAuditLog = async ({
  actorUserId = null,
  action,
  targetType = 'system',
  targetId = null,
  targetLabel = null,
  details = null,
}) =>
  AdminAuditLog.create({
    actor: actorUserId,
    action,
    targetType,
    targetId: targetId != null ? String(targetId) : null,
    targetLabel,
    details,
  });

const listAdminAuditLogs = async () =>
  AdminAuditLog.find({})
    .sort({ createdAt: -1 })
    .populate('actor', 'email name username role')
    .lean();

module.exports = {
  createAdminAuditLog,
  listAdminAuditLogs,
};
