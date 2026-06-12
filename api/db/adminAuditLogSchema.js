const mongoose = require('mongoose');

const adminAuditLogSchema = new mongoose.Schema(
  {
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    action: {
      type: String,
      required: true,
      trim: true,
    },
    targetType: {
      type: String,
      default: 'system',
      trim: true,
    },
    targetId: {
      type: String,
      default: null,
      trim: true,
    },
    targetLabel: {
      type: String,
      default: null,
      trim: true,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.models.AdminAuditLog || mongoose.model('AdminAuditLog', adminAuditLogSchema);
