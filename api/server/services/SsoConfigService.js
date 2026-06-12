const { logger, encryptV2, decryptV2 } = require('@librechat/data-schemas');
const { getAdminConfig, updateAdminConfig } = require('~/models/adminConfig');

/**
 * Admin-managed SSO configuration service.
 *
 * Single source of truth for effective OpenID config and auth mode.
 * Precedence: admin DB config (when `sso.openid.enabled` and complete) overrides
 * env; otherwise env-based behavior is preserved. This keeps existing
 * deployments byte-for-byte unchanged until an admin saves config.
 *
 * NOTE: This module is intentionally NOT yet imported by the live auth path.
 * Slice 1 adds the model + resolver only (no behavior change). Wiring into the
 * passport strategy bootstrap and /api/config login flags happens in a later,
 * separately-reviewable slice.
 */

const AUTH_MODES = ['local_only', 'local_and_sso', 'sso_only'];
const DEFAULT_AUTH_MODE = 'local_and_sso';
const OPENID_FIELDS = [
  'clientId',
  'issuer',
  'scope',
  'callbackUrl',
  'buttonLabel',
  'imageUrl',
  'autoRedirect',
  'emailClaim',
  'usernameClaim',
  'nameClaim',
  'requiredRole',
  'adminRole',
  'allowedDomains',
];

const trimOrUndefined = (value) => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
};

/** Effective OpenID config sourced from env (fallback / current behavior). */
const getEnvOpenIdConfig = () => {
  const clientId = trimOrUndefined(process.env.OPENID_CLIENT_ID);
  const clientSecret = trimOrUndefined(process.env.OPENID_CLIENT_SECRET);
  const issuer = trimOrUndefined(process.env.OPENID_ISSUER);
  const scope = trimOrUndefined(process.env.OPENID_SCOPE);
  const sessionSecret = trimOrUndefined(process.env.OPENID_SESSION_SECRET);

  const configured = Boolean(clientId && clientSecret && issuer && scope && sessionSecret);

  return {
    source: 'env',
    enabled: configured,
    clientId,
    clientSecret,
    issuer,
    scope,
    callbackUrl: trimOrUndefined(process.env.OPENID_CALLBACK_URL),
    buttonLabel: trimOrUndefined(process.env.OPENID_BUTTON_LABEL),
    imageUrl: trimOrUndefined(process.env.OPENID_IMAGE_URL),
    autoRedirect: process.env.OPENID_AUTO_REDIRECT === 'true',
    emailClaim: trimOrUndefined(process.env.OPENID_EMAIL_CLAIM),
    usernameClaim: trimOrUndefined(process.env.OPENID_USERNAME_CLAIM),
    nameClaim: trimOrUndefined(process.env.OPENID_NAME_CLAIM),
    requiredRole: trimOrUndefined(process.env.OPENID_REQUIRED_ROLE),
    adminRole: trimOrUndefined(process.env.OPENID_ADMIN_ROLE),
    allowedDomains: undefined,
    error: null,
  };
};

const hasRequiredDbFields = (openid) =>
  Boolean(openid && openid.enabled === true && openid.clientId && openid.issuer && openid.clientSecret);

/**
 * Resolve the EFFECTIVE OpenID config.
 * Returns DB config (with decrypted secret) when enabled and complete; otherwise
 * falls back to env. On decrypt failure, returns disabled with an error rather
 * than silently using a different (env) identity provider.
 * @returns {Promise<object>} normalized effective config
 */
const getEffectiveOpenIdConfig = async () => {
  let adminConfig;
  try {
    adminConfig = await getAdminConfig();
  } catch (err) {
    logger.error('[SsoConfigService] Failed to read admin config; falling back to env', err);
    return getEnvOpenIdConfig();
  }

  const openid = adminConfig?.sso?.openid;
  if (!hasRequiredDbFields(openid)) {
    return getEnvOpenIdConfig();
  }

  let clientSecret;
  try {
    clientSecret = await decryptV2(openid.clientSecret);
  } catch (err) {
    logger.error('[SsoConfigService] Failed to decrypt OpenID client secret', err);
    return {
      source: 'db',
      enabled: false,
      clientId: openid.clientId,
      issuer: openid.issuer,
      error: 'client_secret_decrypt_failed',
    };
  }

  const effective = { source: 'db', enabled: true, clientSecret, error: null };
  for (const field of OPENID_FIELDS) {
    effective[field] = openid[field] ?? undefined;
  }
  effective.clientId = openid.clientId;
  effective.issuer = openid.issuer;
  effective.scope = openid.scope;
  return effective;
};

/** Effective auth mode: DB value if set, else default (env-equivalent). */
const getEffectiveAuthMode = async () => {
  try {
    const adminConfig = await getAdminConfig();
    if (AUTH_MODES.includes(adminConfig?.authMode)) {
      return adminConfig.authMode;
    }
  } catch (err) {
    logger.error('[SsoConfigService] Failed to read auth mode; using default', err);
  }
  return DEFAULT_AUTH_MODE;
};

/**
 * Admin-facing status. NEVER returns the raw client secret — only whether one
 * exists. Safe to send to the admin console.
 * @returns {Promise<object>}
 */
const getOpenIdAdminStatus = async () => {
  const [effective, authMode] = await Promise.all([
    getEffectiveOpenIdConfig(),
    getEffectiveAuthMode(),
  ]);

  const { clientSecret, ...rest } = effective;
  return {
    ...rest,
    authMode,
    secretStored: Boolean(clientSecret),
  };
};

/**
 * Persist OpenID config. Handles the masked-secret lifecycle:
 *  - secretAction 'replace' + clientSecret => encrypt & store
 *  - secretAction 'keep'                    => leave existing secret untouched
 *  - secretAction 'clear'                   => remove stored secret
 * Returns the safe admin status (no plaintext secret).
 * @param {object} input
 * @param {object} [input.fields] - non-secret openid fields to set
 * @param {string} [input.secretAction] - 'replace' | 'keep' | 'clear'
 * @param {string} [input.clientSecret] - required when secretAction === 'replace'
 * @param {boolean} [input.enabled]
 */
const updateOpenIdConfig = async ({ fields = {}, secretAction = 'keep', clientSecret, enabled } = {}) => {
  const updates = {};

  if (typeof enabled === 'boolean') {
    updates['sso.openid.enabled'] = enabled;
  }

  for (const field of OPENID_FIELDS) {
    if (fields[field] !== undefined) {
      updates[`sso.openid.${field}`] = fields[field];
    }
  }

  if (secretAction === 'replace') {
    const secret = trimOrUndefined(clientSecret);
    if (!secret) {
      throw new Error('clientSecret is required when secretAction is "replace"');
    }
    updates['sso.openid.clientSecret'] = await encryptV2(secret);
  } else if (secretAction === 'clear') {
    updates['sso.openid.clientSecret'] = '';
  }

  if (Object.keys(updates).length > 0) {
    await updateAdminConfig(updates);
  }

  return getOpenIdAdminStatus();
};

/** Update auth mode with enum validation. */
const updateAuthMode = async (authMode) => {
  if (!AUTH_MODES.includes(authMode)) {
    throw new Error(`Invalid authMode: ${authMode}`);
  }
  await updateAdminConfig({ authMode });
  return getEffectiveAuthMode();
};

/**
 * Validate an OpenID issuer by fetching its discovery document.
 * Read-only: performs no persistence and registers nothing. Safe to call from a
 * "Test connection" button before saving.
 * @param {string} issuer
 * @returns {Promise<{ok: boolean, error?: string, missing?: string[], issuer?: string, endpoints?: object, detail?: string}>}
 */
const validateOpenIdDiscovery = async (issuer) => {
  const base = trimOrUndefined(issuer);
  if (!base) {
    return { ok: false, error: 'issuer_required' };
  }

  const url = `${base.replace(/\/+$/, '')}/.well-known/openid-configuration`;
  try {
    const response = await fetch(url, { method: 'GET' });
    if (!response.ok) {
      return { ok: false, error: `discovery_http_${response.status}` };
    }

    const doc = await response.json();
    const required = ['authorization_endpoint', 'token_endpoint', 'jwks_uri'];
    const missing = required.filter((key) => !doc?.[key]);
    if (missing.length > 0) {
      return { ok: false, error: 'discovery_incomplete', missing };
    }

    return {
      ok: true,
      issuer: doc.issuer ?? base,
      endpoints: {
        authorization_endpoint: doc.authorization_endpoint,
        token_endpoint: doc.token_endpoint,
        jwks_uri: doc.jwks_uri,
      },
    };
  } catch (err) {
    logger.warn(`[SsoConfigService] OpenID discovery failed for ${url}: ${err.message}`);
    return { ok: false, error: 'discovery_unreachable', detail: err.message };
  }
};

module.exports = {
  AUTH_MODES,
  DEFAULT_AUTH_MODE,
  getEffectiveOpenIdConfig,
  getEffectiveAuthMode,
  getOpenIdAdminStatus,
  updateOpenIdConfig,
  updateAuthMode,
  validateOpenIdDiscovery,
};
