// cowork — builtin agent tool: let the Cowork coworker create/list/manage scheduled routines from
// chat. Only granted to the Cowork agent (see initialize.js) and scoped to the CURRENT project via
// req.body.coworkProjectId. Reuses the exact same model functions + ownership checks as the
// Routines panel and REST routes — nothing global or in the main chat changes.
const { z } = require('zod');
const { tool } = require('@langchain/core/tools');
const { logger } = require('@librechat/data-schemas');
const {
  createCoworkRoutine,
  getUserCoworkRoutines,
  getCoworkRoutine,
  updateCoworkRoutine,
  deleteCoworkRoutine,
} = require('~/models/CoworkRoutine');
const { deleteRoutineRuns } = require('~/models/CoworkRoutineRun');

const manageRoutinesSchema = z.object({
  action: z
    .enum(['list', 'create', 'enable', 'disable', 'delete'])
    .describe('What to do with this project’s routines.'),
  name: z
    .string()
    .optional()
    .describe(
      'Routine name. Required for "create". For enable/disable/delete you may pass either name or routineId.',
    ),
  prompt: z
    .string()
    .optional()
    .describe('The instruction the coworker runs each time the routine fires. Required for "create".'),
  cronExpression: z
    .string()
    .optional()
    .describe(
      'Standard 5-field cron: "minute hour day-of-month month day-of-week" (e.g. "0 9 * * 1-5" = weekdays 9am). Omit or leave empty for a manual-only routine (no schedule; only runs via Run now).',
    ),
  deliveryTarget: z
    .enum(['message', 'file'])
    .optional()
    .describe(
      "Where the result goes: 'message' (in the conversation, default) or 'file' (also saved as a workspace markdown file).",
    ),
  routineId: z
    .string()
    .optional()
    .describe('The routine id (from a prior "list") to enable/disable/delete.'),
  autoApprove: z
    .boolean()
    .optional()
    .describe(
      'For "create": allow this routine to perform external connector writes (publish/send/update) automatically on each unattended run, with no approval. Default false (writes are withheld on scheduled runs). Only set true if the user explicitly asks for it — it is a conscious risk.',
    ),
});

function formatWhen(value) {
  if (!value) {
    return 'n/a';
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? 'n/a' : d.toISOString();
}

function describeRoutine(r) {
  const schedule = r.cronExpression ? `cron "${r.cronExpression}"` : 'manual only';
  const state = r.cronExpression ? (r.enabled ? 'enabled' : 'disabled') : 'manual';
  const next = r.enabled && r.cronExpression ? `, next ${formatWhen(r.nextRun)}` : '';
  const delivery = r.deliveryTarget === 'file' ? ', delivery: file' : ', delivery: message';
  const autoWrites = r.autoApprove ? ', auto-approve writes: ON' : '';
  return `"${r.name}" — ${schedule} (${state}${next})${delivery}${autoWrites} — id: ${r._id}`;
}

/**
 * Build the manage_routines tool, closed over the live request so it can read the user and the
 * current Cowork project. Returns a DynamicStructuredTool whose handler always resolves to a string.
 */
function createManageRoutinesTool(fields = {}) {
  const req = fields.req;

  const handler = async (input) => {
    try {
      const userId = req?.user?.id;
      const projectId = req?.body?.coworkProjectId;
      if (!userId || !projectId) {
        return 'Routines can only be managed from inside a Cowork project.';
      }

      const action = input?.action;

      // Resolve a target routine for enable/disable/delete by id, or by exact name within this project.
      const resolveTarget = async () => {
        if (input.routineId) {
          const byId = await getCoworkRoutine({ user: userId, routineId: input.routineId });
          return byId && byId.projectId === projectId ? byId : null;
        }
        if (input.name) {
          const all = await getUserCoworkRoutines({ user: userId, projectId });
          const matches = all.filter(
            (r) => r.name.trim().toLowerCase() === input.name.trim().toLowerCase(),
          );
          if (matches.length === 1) {
            return matches[0];
          }
          if (matches.length > 1) {
            return { __ambiguous: true };
          }
        }
        return null;
      };

      if (action === 'list') {
        const routines = await getUserCoworkRoutines({ user: userId, projectId });
        if (routines.length === 0) {
          return 'This project has no routines yet.';
        }
        return [
          `This project has ${routines.length} routine(s):`,
          ...routines.map((r, i) => `${i + 1}. ${describeRoutine(r)}`),
        ].join('\n');
      }

      if (action === 'create') {
        if (!input.name || !input.name.trim()) {
          return 'To create a routine, provide a name.';
        }
        if (!input.prompt || !input.prompt.trim()) {
          return 'To create a routine, provide the prompt/instruction it should run.';
        }
        try {
          const routine = await createCoworkRoutine({
            user: userId,
            projectId,
            name: input.name,
            prompt: input.prompt,
            cronExpression: input.cronExpression || '',
            deliveryTarget: input.deliveryTarget,
            autoApprove: input.autoApprove === true,
          });
          return `Created routine ${describeRoutine(routine)}`;
        } catch (createErr) {
          return `Could not create the routine: ${createErr.message || 'unknown error'}`;
        }
      }

      if (action === 'enable' || action === 'disable') {
        const target = await resolveTarget();
        if (target?.__ambiguous) {
          return `More than one routine is named "${input.name}". Use its routineId (run "list" first).`;
        }
        if (!target) {
          return 'No matching routine found. Provide a valid routineId or exact name (run "list" first).';
        }
        if (!target.cronExpression) {
          return `Routine "${target.name}" is manual-only (no schedule), so there is nothing to ${action}.`;
        }
        try {
          const updated = await updateCoworkRoutine({
            user: userId,
            routineId: target._id,
            enabled: action === 'enable',
          });
          return `Routine ${describeRoutine(updated)}`;
        } catch (updErr) {
          return `Could not ${action} the routine: ${updErr.message || 'unknown error'}`;
        }
      }

      if (action === 'delete') {
        const target = await resolveTarget();
        if (target?.__ambiguous) {
          return `More than one routine is named "${input.name}". Use its routineId (run "list" first).`;
        }
        if (!target) {
          return 'No matching routine found. Provide a valid routineId or exact name (run "list" first).';
        }
        await deleteCoworkRoutine({ user: userId, routineId: target._id });
        await deleteRoutineRuns(target._id).catch(() => {});
        return `Deleted routine "${target.name}".`;
      }

      return `Unknown action "${action}". Use one of: list, create, enable, disable, delete.`;
    } catch (error) {
      logger.error('[manage_routines] tool error', error);
      return `The routine operation failed: ${error.message || 'unknown error'}`;
    }
  };

  return tool(handler, {
    name: 'manage_routines',
    description:
      'Create and manage scheduled automations ("routines") for the CURRENT Cowork project. A routine is a saved prompt the coworker runs automatically on a schedule (or manually). Use it when the user asks to do something "every day/week", "each morning", "on a schedule", or to set up / list / enable / disable / delete a routine. Translate natural-language timing into a 5-field cron expression. Always confirm the routine details with the user before creating or deleting one.',
    schema: manageRoutinesSchema,
  });
}

module.exports = createManageRoutinesTool;
