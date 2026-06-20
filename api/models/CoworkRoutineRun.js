// cowork — Phase 4: per-run history for routines. One document per execution, recorded by the
// headless runner. Owner-scoped reads via `user` (mirrors CoworkRoutine). Old runs are pruned so a
// frequently-scheduled routine can't grow history without bound.
const { CoworkRoutineRun } = require('~/db/models');

// Keep at most this many run records per routine; older ones are pruned after each new run starts.
const MAX_RUNS_PER_ROUTINE = 50;

/**
 * Record the start of a run. Returns the created run doc (its _id is used to finalize later).
 * Also prunes history beyond MAX_RUNS_PER_ROUTINE for this routine.
 * @param {object} opts
 * @param {string} opts.routineId
 * @param {string} opts.user
 * @param {string} opts.projectId
 * @param {string} [opts.trigger] - 'manual' | 'scheduled'
 * @returns {Promise<object>}
 */
const recordRunStart = async ({ routineId, user, projectId, trigger = 'manual' }) => {
  const run = await CoworkRoutineRun.create({
    routineId,
    user,
    projectId,
    trigger,
    status: 'running',
    startedAt: new Date(),
  });
  // Best-effort pruning — never let it block or fail a run.
  pruneRoutineRuns(routineId).catch(() => {});
  return run.toObject();
};

/**
 * Finalize a run with its outcome.
 * @param {object} opts
 * @param {string} opts.runId
 * @param {string} opts.status - 'success' | 'error'
 * @param {string} [opts.error]
 * @param {string} [opts.conversationId]
 * @param {string} [opts.deliveredPath]
 * @returns {Promise<object|null>}
 */
const recordRunEnd = async ({ runId, status, error, conversationId, deliveredPath }) => {
  if (!runId) {
    return null;
  }
  const finishedAt = new Date();
  const existing = await CoworkRoutineRun.findById(runId).lean();
  const startedAt = existing?.startedAt ? new Date(existing.startedAt) : finishedAt;
  const $set = {
    status,
    finishedAt,
    durationMs: Math.max(0, finishedAt.getTime() - startedAt.getTime()),
    error: status === 'error' ? String(error || 'Unknown error').slice(0, 2000) : '',
  };
  if (conversationId) {
    $set.conversationId = conversationId;
  }
  if (deliveredPath) {
    $set.deliveredPath = deliveredPath;
  }
  return CoworkRoutineRun.findByIdAndUpdate(runId, { $set }, { new: true }).lean();
};

/**
 * List a routine's runs, newest first. Owner-scoped.
 * @param {object} opts
 * @param {string} opts.user
 * @param {string} opts.routineId
 * @param {number} [opts.limit]
 * @returns {Promise<object[]>}
 */
const getRoutineRuns = async ({ user, routineId, limit = 20 }) => {
  const capped = Math.min(Math.max(1, Number(limit) || 20), 100);
  return CoworkRoutineRun.find({ user, routineId })
    .sort({ startedAt: -1 })
    .limit(capped)
    .lean();
};

/** Delete run records beyond the most recent MAX_RUNS_PER_ROUTINE for a routine. */
const pruneRoutineRuns = async (routineId) => {
  const survivors = await CoworkRoutineRun.find({ routineId })
    .sort({ startedAt: -1 })
    .skip(MAX_RUNS_PER_ROUTINE)
    .select('_id')
    .lean();
  if (survivors.length === 0) {
    return 0;
  }
  const ids = survivors.map((r) => r._id);
  const result = await CoworkRoutineRun.deleteMany({ _id: { $in: ids } });
  return result?.deletedCount ?? 0;
};

/** Remove all run history for a routine (called when the routine itself is deleted). */
const deleteRoutineRuns = async (routineId) => {
  const result = await CoworkRoutineRun.deleteMany({ routineId });
  return result?.deletedCount ?? 0;
};

module.exports = {
  recordRunStart,
  recordRunEnd,
  getRoutineRuns,
  pruneRoutineRuns,
  deleteRoutineRuns,
  MAX_RUNS_PER_ROUTINE,
};
