const mongoose = require('mongoose');

const adminConfigSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: 'global',
    },
    allowedDomains: {
      type: [String],
      required: false,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.models.AdminConfig || mongoose.model('AdminConfig', adminConfigSchema);
