const { createAdminAuditLog, listAdminAuditLogs } = require('~/models/adminAuditLog');

const logAdminAction = async ({
  actorUserId = null,
  action,
  targetType = 'system',
  targetId = null,
  targetLabel = null,
  details = null,
}) => {
  if (!action) {
    return null;
  }

  return createAdminAuditLog({
    actorUserId,
    action,
    targetType,
    targetId,
    targetLabel,
    details,
  });
};

module.exports = {
  listAdminAuditLogs,
  logAdminAction,
};
