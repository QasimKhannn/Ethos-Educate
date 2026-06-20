// cowork — CRUD for Cowork routines (scheduled automations). Separate collection; ownership-scoped
// by `user` exactly like CoworkProject. Phase 1: create/list/get/update/delete + a run-status marker.
// Phase 2 adds cron validation, nextRun computation, and an atomic claim for the scheduler.
const { CoworkRoutine, CoworkProject } = require('~/db/models');
const { logger } = require('@librechat/data-schemas');
const { validateCron, getNextRun, getMinGapMinutes } = require('~/server/services/Cowork/coworkCron');

const MAX_NAME = 128;
const MAX_PROMPT = 8000;
const MAX_CRON = 128;
const MAX_MODE = 16;

// Phase 6 hardening — env-configurable quotas/limits with sane defaults.
const intFromEnv = (key, fallback) => {
  const n = parseInt(process.env[key] || '', 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};
const MAX_PER_USER = intFromEnv('COWORK_ROUTINES_MAX_PER_USER', 25);
const MIN_INTERVAL_MIN = intFromEnv('COWORK_ROUTINES_MIN_INTERVAL_MIN', 5);
const MAX_FAILURES = intFromEnv('COWORK_ROUTINES_MAX_FAILURES', 5);

/**
 * Validate a cron expression's format AND that it doesn't fire more often than the minimum allowed
 * interval. No-op for an empty (manual-only) cron. Throws on violation.
 */
const assertScheduleAllowed = (cronExpression) => {
  if (!cronExpression) {
    return;
  }
  const { valid, error } = validateCron(cronExpression);
  if (!valid) {
    throw new Error(`Invalid cron expression: ${error}`);
  }
  const gapMin = getMinGapMinutes(cronExpression);
  if (gapMin < MIN_INTERVAL_MIN) {
    throw new Error(
      `Schedule is too frequent — minimum interval is ${MIN_INTERVAL_MIN} minute(s) between runs.`,
    );
  }
};

// Phase 4: where a run's result is delivered. 'message' = the conversation only (default);
// 'file' = also write a Markdown copy into the project workspace.
const ALLOWED_DELIVERY = ['message', 'file'];
const normalizeDelivery = (value) =>
  ALLOWED_DELIVERY.includes(value) ? value : undefined;

/**
 * Compute the next fire time for a routine. Returns null when the routine should NOT be scheduled
 * (no cron expression, or disabled). Throws if the cron expression is non-empty but invalid.
 * @param {string} cronExpression
 * @param {boolean} enabled
 * @param {Date} [from]
 * @returns {Date|null}
 */
const computeNextRun = (cronExpression, enabled, from = new Date()) => {
  if (!cronExpression || enabled === false) {
    return null;
  }
  const { valid, error } = validateCron(cronExpression);
  if (!valid) {
    throw new Error(`Invalid cron expression: ${error}`);
  }
  return getNextRun(cronExpression, from);
};

const normalizeText = (value, maxLength) => {
  if (typeof value !== 'string') {
    return undefined;
  }
  return value.trim().slice(0, maxLength);
};

const ownerFilter = (user, routineId) => ({ _id: routineId, user });

/** Confirm the project belongs to the user before attaching a routine to it. */
const assertOwnsProject = async (user, projectId) => {
  const project = await CoworkProject.findOne({ _id: projectId, user }).lean();
  if (!project) {
    throw new Error('Project not found');
  }
  return project;
};

const createCoworkRoutine = async ({
  user,
  projectId,
  name,
  prompt,
  cronExpression = '',
  mode = 'agent',
  enabled = true,
  autoApprove = false,
  deliveryTarget,
}) => {
  const normalizedName = normalizeText(name, MAX_NAME);
  if (!normalizedName) {
    throw new Error('Routine name is required');
  }
  const normalizedPrompt = normalizeText(prompt, MAX_PROMPT);
  if (!normalizedPrompt) {
    throw new Error('Routine prompt is required');
  }
  if (!projectId) {
    throw new Error('projectId is required');
  }
  await assertOwnsProject(user, projectId);

  // Phase 6: per-user quota.
  const existingCount = await CoworkRoutine.countDocuments({ user });
  if (existingCount >= MAX_PER_USER) {
    throw new Error(
      `Routine limit reached (${MAX_PER_USER}). Delete an existing routine before creating a new one.`,
    );
  }

  const normalizedCron = normalizeText(cronExpression, MAX_CRON) ?? '';
  const isEnabled = enabled !== false;
  // Phase 6: reject invalid or too-frequent schedules (even when disabled, so enabling later is safe).
  assertScheduleAllowed(normalizedCron);
  // Throws if cron is non-empty but invalid; null when no cron / disabled.
  const nextRun = computeNextRun(normalizedCron, isEnabled);

  const doc = await CoworkRoutine.create({
    user,
    projectId,
    name: normalizedName,
    prompt: normalizedPrompt,
    cronExpression: normalizedCron,
    mode: normalizeText(mode, MAX_MODE) || 'agent',
    enabled: isEnabled,
    autoApprove: autoApprove === true,
    deliveryTarget: normalizeDelivery(deliveryTarget) || 'message',
    nextRun,
  });
  return doc.toObject();
};

/** All routines for a user (optionally filtered to one project), newest first. */
const getUserCoworkRoutines = async ({ user, projectId } = {}) => {
  const filter = { user };
  if (projectId) {
    filter.projectId = projectId;
  }
  return CoworkRoutine.find(filter).sort({ updatedAt: -1 }).lean();
};

const getCoworkRoutine = async ({ user, routineId }) => {
  return CoworkRoutine.findOne(ownerFilter(user, routineId)).lean();
};

const updateCoworkRoutine = async ({
  user,
  routineId,
  name,
  prompt,
  cronExpression,
  mode,
  enabled,
  autoApprove,
  deliveryTarget,
}) => {
  const $set = {};
  const normalizedName = normalizeText(name, MAX_NAME);
  if (normalizedName !== undefined) {
    if (!normalizedName) {
      throw new Error('Routine name is required');
    }
    $set.name = normalizedName;
  }
  const normalizedPrompt = normalizeText(prompt, MAX_PROMPT);
  if (normalizedPrompt !== undefined) {
    if (!normalizedPrompt) {
      throw new Error('Routine prompt is required');
    }
    $set.prompt = normalizedPrompt;
  }
  const normalizedCron = normalizeText(cronExpression, MAX_CRON);
  if (normalizedCron !== undefined) {
    $set.cronExpression = normalizedCron;
  }
  const normalizedMode = normalizeText(mode, MAX_MODE);
  if (normalizedMode !== undefined) {
    $set.mode = normalizedMode || 'agent';
  }
  if (typeof enabled === 'boolean') {
    $set.enabled = enabled;
  }
  if (typeof autoApprove === 'boolean') {
    $set.autoApprove = autoApprove;
  }
  const normalizedDelivery = normalizeDelivery(deliveryTarget);
  if (normalizedDelivery !== undefined) {
    $set.deliveryTarget = normalizedDelivery;
  }

  // Recompute nextRun only when the schedule-affecting fields are part of this update, so a
  // benign patch (e.g. renaming) doesn't clobber the nextRun the scheduler has advanced.
  const scheduleTouched = normalizedCron !== undefined || typeof enabled === 'boolean';
  if (scheduleTouched) {
    const current = await CoworkRoutine.findOne(ownerFilter(user, routineId)).lean();
    if (!current) {
      return null;
    }
    const effectiveCron = normalizedCron !== undefined ? normalizedCron : current.cronExpression || '';
    const effectiveEnabled = typeof enabled === 'boolean' ? enabled : current.enabled;
    // Phase 6: re-validate format + min interval whenever the schedule changes.
    if (normalizedCron !== undefined) {
      assertScheduleAllowed(effectiveCron);
    }
    // Phase 6: re-enabling a routine clears any auto-disable reason and resets the failure counter.
    if (enabled === true) {
      $set.disabledReason = '';
      $set.consecutiveFailures = 0;
    }
    // Throws on an invalid non-empty cron; the route surfaces this as a 400.
    $set.nextRun = computeNextRun(effectiveCron, effectiveEnabled);
  }

  return CoworkRoutine.findOneAndUpdate(ownerFilter(user, routineId), { $set }, { new: true }).lean();
};

const deleteCoworkRoutine = async ({ user, routineId }) => {
  return CoworkRoutine.findOneAndDelete(ownerFilter(user, routineId)).lean();
};

/**
 * Record the outcome of a run. Called by the runner (Phase 1) and scheduler (Phase 2).
 * Not ownership-scoped by `user` because the runner/scheduler act on the routine doc directly.
 */
const markRoutineRun = async ({ routineId, status, error, conversationId }) => {
  const $set = { lastRun: new Date(), lastStatus: status };
  $set.lastError = status === 'error' ? String(error || 'Unknown error').slice(0, 2000) : '';
  if (conversationId) {
    $set.lastConversationId = conversationId;
  }

  // Phase 6: success clears the failure streak (and any auto-disable reason).
  if (status === 'success') {
    $set.consecutiveFailures = 0;
    $set.disabledReason = '';
    return CoworkRoutine.findByIdAndUpdate(routineId, { $set }, { new: true }).lean();
  }

  // Phase 6: circuit breaker — count consecutive failures and auto-disable past the threshold.
  if (status === 'error') {
    const current = await CoworkRoutine.findById(routineId).select('consecutiveFailures name').lean();
    const newCount = (current?.consecutiveFailures || 0) + 1;
    $set.consecutiveFailures = newCount;
    if (newCount >= MAX_FAILURES) {
      $set.enabled = false;
      $set.nextRun = null;
      $set.disabledReason =
        `Auto-disabled after ${newCount} consecutive failures. Last error: ${$set.lastError}`.slice(
          0,
          2000,
        );
      logger.warn(
        `[CoworkRoutine] auto-disabled routine ${routineId} (${current?.name || ''}) after ${newCount} consecutive failures`,
      );
    }
    return CoworkRoutine.findByIdAndUpdate(routineId, { $set }, { new: true }).lean();
  }

  // status 'running' (or anything else): only update the run markers.
  return CoworkRoutine.findByIdAndUpdate(routineId, { $set }, { new: true }).lean();
};

/**
 * Atomically claim ONE due routine for the scheduler (multi-instance safe).
 *
 * Finds an enabled routine with a scheduled `nextRun` at or before `now` and, in the same atomic
 * operation, pushes its `nextRun` forward by a short lease. Because the claim and the lease-advance
 * are a single `findOneAndUpdate`, no other instance or overlapping tick can grab the same routine
 * while it runs. After the run completes the caller replaces the lease with the real next occurrence
 * via `rescheduleRoutine`. If the process crashes mid-run, the lease expires and the routine is
 * retried on a later tick (at-least-once delivery).
 *
 * @param {object} opts
 * @param {Date} [opts.now] - reference time (defaults to now).
 * @param {number} [opts.leaseMs] - how long the claim holds the routine before it's eligible again.
 * @returns {Promise<object|null>} the pre-claim routine document, or null if none are due.
 */
const claimDueRoutine = async ({ now = new Date(), leaseMs = 5 * 60 * 1000 } = {}) => {
  const leaseUntil = new Date(now.getTime() + leaseMs);
  return CoworkRoutine.findOneAndUpdate(
    {
      enabled: true,
      cronExpression: { $nin: [null, ''] },
      nextRun: { $ne: null, $lte: now },
    },
    { $set: { nextRun: leaseUntil, lastStatus: 'running' } },
    { new: false, sort: { nextRun: 1 } },
  ).lean();
};

/**
 * Set a routine's next fire time from its cron expression after a run completes. If the cron is
 * empty/invalid (shouldn't happen for a claimed routine), nextRun is cleared so it stops scheduling.
 * Not ownership-scoped — the scheduler acts on the routine doc directly.
 * @param {object} opts
 * @param {string} opts.routineId
 * @param {string} opts.cronExpression
 * @param {Date} [opts.from]
 * @returns {Promise<object|null>}
 */
const rescheduleRoutine = async ({ routineId, cronExpression, from = new Date() }) => {
  // Phase 6: don't re-arm a routine that was disabled during the run (e.g. by the circuit breaker).
  const current = await CoworkRoutine.findById(routineId).select('enabled').lean();
  let nextRun = null;
  if (current && current.enabled !== false) {
    try {
      if (cronExpression) {
        nextRun = getNextRun(cronExpression, from);
      }
    } catch {
      nextRun = null;
    }
  }
  return CoworkRoutine.findByIdAndUpdate(routineId, { $set: { nextRun } }, { new: true }).lean();
};

module.exports = {
  createCoworkRoutine,
  getUserCoworkRoutines,
  getCoworkRoutine,
  updateCoworkRoutine,
  deleteCoworkRoutine,
  markRoutineRun,
  computeNextRun,
  claimDueRoutine,
  rescheduleRoutine,
};
