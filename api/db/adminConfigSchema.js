const mongoose = require('mongoose');

/**
 * Admin-managed OpenID/OIDC settings.
 * All fields optional: when absent or `enabled` is not true, the app falls back
 * to env-based OpenID behavior, so existing deployments are unaffected.
 * `clientSecret` is stored ENCRYPTED at rest (encryptV2); never persisted in plaintext.
 */
const ssoOpenidSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, required: false },
    clientId: { type: String, required: false },
    clientSecret: { type: String, required: false },
    issuer: { type: String, required: false },
    scope: { type: String, required: false },
    callbackUrl: { type: String, required: false },
    buttonLabel: { type: String, required: false },
    imageUrl: { type: String, required: false },
    autoRedirect: { type: Boolean, required: false },
    emailClaim: { type: String, required: false },
    usernameClaim: { type: String, required: false },
    nameClaim: { type: String, required: false },
    requiredRole: { type: String, required: false },
    adminRole: { type: String, required: false },
    allowedDomains: { type: [String], required: false },
  },
  { _id: false },
);

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
    inviteOnlyRegistration: {
      type: Boolean,
      required: false,
    },
    /**
     * Controls availability of local (password) vs SSO login.
     * Absent => current env-driven behavior (treated as local_and_sso fallback).
     */
    authMode: {
      type: String,
      enum: ['local_only', 'local_and_sso', 'sso_only'],
      required: false,
    },
    sso: {
      openid: { type: ssoOpenidSchema, required: false },
    },
  },
  { timestamps: true },
);

module.exports = mongoose.models.AdminConfig || mongoose.model('AdminConfig', adminConfigSchema);
