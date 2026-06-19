// cowork — Phase 2: the Routines scheduler.
//
// A single backend interval poller that drives scheduled routine runs. Each tick claims due
// routines one at a time via an ATOMIC `findOneAndUpdate` (see `claimDueRoutine`), so running
// multiple backend instances is safe — only one instance ever wins a given routine. After a run it
// recomputes `nextRun` from the routine's cron expression.
//
// Strictly additive & isolated: this touches only the CoworkRoutine collection and only runs when
// `COWORK_ROUTINES_ENABLED` is set. It never affects the main chat, other agents, or other users.
//
// Deployment note: this assumes an always-on backend. If prod scales to zero, the interval won't
// fire while idle — trigger runs via an external ping/cron hitting an endpoint instead (future work).
const { isEnabled } = require('@librechat/api');
const { logger } = require('@librechat/data-schemas');
const { runRoutine } = require('~/server/services/Cowork/CoworkRoutineRunner');
const { claimDueRoutine, rescheduleRoutine } = require('~/models/CoworkRoutine');

const DEFAULT_POLL_MS = 30 * 1000; // how often to check for due routines
const MIN_POLL_MS = 5 * 1000; // floor, so a misconfigured env can't busy-loop
const MAX_PER_TICK = 25; // cap routines processed per tick (back-pressure / fairness)
const CLAIM_LEASE_MS = 10 * 60 * 1000; // how long a claim holds a routine before retry eligibility

let pollTimer = null;
let isPolling = false; // guards against a slow tick overlapping the next interval

/** Parse COWORK_ROUTINES_POLL_MS into a sane interval (defaults + floor). */
function resolvePollMs() {
  const raw = parseInt(process.env.COWORK_ROUTINES_POLL_MS || '', 10);
  if (Number.isFinite(raw) && raw > 0) {
    return Math.max(raw, MIN_POLL_MS);
  }
  return DEFAULT_POLL_MS;
}

/**
 * One polling pass: claim and run every routine that's currently due, up to MAX_PER_TICK.
 * Runs are sequential to avoid stampeding the agent backend. Errors in one routine never abort
 * the loop or the scheduler — they're recorded on the routine (by the runner) and logged.
 */
async function pollOnce() {
  if (isPolling) {
    return; // previous tick still working; skip this one
  }
  isPolling = true;
  let processed = 0;
  try {
    for (; processed < MAX_PER_TICK; processed++) {
      const now = new Date();
      const routine = await claimDueRoutine({ now, leaseMs: CLAIM_LEASE_MS });
      if (!routine) {
        break; // nothing due
      }
      logger.info(`[CoworkRoutineScheduler] running routine ${routine._id} (${routine.name})`);
      try {
        await runRoutine(routine, { trigger: 'scheduled' });
      } catch (error) {
        // runRoutine handles its own errors, but guard the loop against anything unexpected.
        logger.error(`[CoworkRoutineScheduler] routine ${routine._id} threw`, error);
      } finally {
        // Replace the claim lease with the real next occurrence, regardless of run outcome.
        try {
          await rescheduleRoutine({
            routineId: routine._id,
            cronExpression: routine.cronExpression,
            from: new Date(),
          });
        } catch (error) {
          logger.error(`[CoworkRoutineScheduler] failed to reschedule routine ${routine._id}`, error);
        }
      }
    }
  } catch (error) {
    logger.error('[CoworkRoutineScheduler] poll cycle error', error);
  } finally {
    isPolling = false;
    if (processed > 0) {
      logger.debug(`[CoworkRoutineScheduler] processed ${processed} routine(s) this tick`);
    }
  }
}

/**
 * Start the scheduler. No-op (with a log) unless COWORK_ROUTINES_ENABLED is truthy. Idempotent —
 * calling twice won't create a second timer.
 * @returns {boolean} whether the scheduler was started.
 */
function startCoworkRoutineScheduler() {
  if (!isEnabled(process.env.COWORK_ROUTINES_ENABLED)) {
    logger.info('[CoworkRoutineScheduler] disabled (set COWORK_ROUTINES_ENABLED=true to enable)');
    return false;
  }
  if (pollTimer) {
    return true; // already running
  }
  const pollMs = resolvePollMs();
  // `unref` so the timer never keeps the process alive on shutdown.
  pollTimer = setInterval(() => {
    pollOnce().catch((error) => logger.error('[CoworkRoutineScheduler] unhandled poll error', error));
  }, pollMs);
  if (typeof pollTimer.unref === 'function') {
    pollTimer.unref();
  }
  logger.info(`[CoworkRoutineScheduler] started — polling every ${pollMs}ms`);
  return true;
}

/** Stop the scheduler (used in tests / graceful shutdown). */
function stopCoworkRoutineScheduler() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  isPolling = false;
}

module.exports = {
  startCoworkRoutineScheduler,
  stopCoworkRoutineScheduler,
  pollOnce,
};
