// cowork — Routines panel (Phase 3): create, list, enable/disable, run-now, and delete scheduled
// automations for a Cowork project. A routine = a saved prompt + schedule the coworker runs
// headlessly (see api/server/services/Cowork/CoworkRoutineRunner.js + CoworkRoutineScheduler.js).
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Play,
  Trash2,
  Plus,
  Clock,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileText,
} from 'lucide-react';
import type {
  TCoworkRoutine,
  TCoworkRoutineRun,
  TCoworkDeliveryTarget,
} from 'librechat-data-provider';
import {
  useCoworkRoutinesQuery,
  useCoworkRoutineRunsQuery,
  useCreateCoworkRoutineMutation,
  useUpdateCoworkRoutineMutation,
  useDeleteCoworkRoutineMutation,
  useRunCoworkRoutineMutation,
} from '~/data-provider';

// ---------------------------------------------------------------------------
// Schedule presets — friendly labels mapped to standard 5-field cron expressions.
// '' = manual-only (no schedule; run via the Run-now button). 'custom' lets the
// user type a raw cron expression (validated server-side on save).
// ---------------------------------------------------------------------------

type SchedulePreset = { id: string; label: string; cron: string };

const SCHEDULE_PRESETS: SchedulePreset[] = [
  { id: 'manual', label: 'Manual only (no schedule)', cron: '' },
  { id: 'hourly', label: 'Every hour', cron: '0 * * * *' },
  { id: 'daily9', label: 'Every day at 9:00 AM', cron: '0 9 * * *' },
  { id: 'weekdays9', label: 'Weekdays at 9:00 AM', cron: '0 9 * * 1-5' },
  { id: 'weeklyMon9', label: 'Every Monday at 9:00 AM', cron: '0 9 * * 1' },
  { id: 'monthly1', label: 'Monthly on the 1st at 9:00 AM', cron: '0 9 1 * *' },
  { id: 'custom', label: 'Custom time…', cron: 'custom' },
];

/** Human label for a stored cron expression (falls back to showing the raw expression). */
function describeSchedule(cron?: string): string {
  if (!cron) {
    return 'Manual only';
  }
  const preset = SCHEDULE_PRESETS.find((p) => p.cron === cron);
  return preset ? preset.label : `Custom: ${cron}`;
}

function formatWhen(value?: string | null): string {
  if (!value) {
    return '—';
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return '—';
  }
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDuration(ms?: number): string {
  if (ms == null || !Number.isFinite(ms)) {
    return '';
  }
  if (ms < 1000) {
    return `${ms}ms`;
  }
  const seconds = ms / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}

const DELIVERY_OPTIONS: { id: TCoworkDeliveryTarget; label: string }[] = [
  { id: 'message', label: 'Message only (in the chat)' },
  { id: 'file', label: 'Message + save to workspace file' },
];

// ---------------------------------------------------------------------------
// Create form
// ---------------------------------------------------------------------------

function CreateRoutineForm({
  projectId,
  onClose,
}: {
  projectId: string;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [presetId, setPresetId] = useState('manual');
  const [customCron, setCustomCron] = useState('');
  const [deliveryTarget, setDeliveryTarget] = useState<TCoworkDeliveryTarget>('message');
  const [autoApprove, setAutoApprove] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createMutation = useCreateCoworkRoutineMutation(projectId);
  const isCustom = presetId === 'custom';

  const resolveCron = (): string => {
    if (isCustom) {
      return customCron.trim();
    }
    return SCHEDULE_PRESETS.find((p) => p.id === presetId)?.cron ?? '';
  };

  const handleSubmit = () => {
    setError(null);
    if (!name.trim()) {
      setError('Give the routine a name.');
      return;
    }
    if (!prompt.trim()) {
      setError('Add the instruction the coworker should run.');
      return;
    }
    createMutation.mutate(
      {
        projectId,
        name: name.trim(),
        prompt: prompt.trim(),
        cronExpression: resolveCron(),
        deliveryTarget,
        autoApprove,
      },
      {
        onSuccess: () => onClose(),
        onError: (err: unknown) => {
          const message =
            (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
            (err as Error)?.message ||
            'Could not create the routine.';
          setError(message);
        },
      },
    );
  };

  return (
    <div className="mb-3 rounded-lg border border-border-medium bg-surface-secondary p-3">
      <label className="mb-1 block text-xs font-medium text-text-secondary">Name</label>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Morning standup summary"
        className="mb-3 w-full rounded-md border border-border-medium bg-surface-primary px-2.5 py-1.5 text-sm text-text-primary placeholder:text-text-tertiary focus:border-blue-500 focus:outline-none"
      />

      <label className="mb-1 block text-xs font-medium text-text-secondary">Instruction</label>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Summarize new files added to the workspace since yesterday and list any action items."
        rows={3}
        className="mb-3 w-full resize-y rounded-md border border-border-medium bg-surface-primary px-2.5 py-1.5 text-sm text-text-primary placeholder:text-text-tertiary focus:border-blue-500 focus:outline-none"
      />

      <label className="mb-1 block text-xs font-medium text-text-secondary">Schedule</label>
      <select
        value={presetId}
        onChange={(e) => setPresetId(e.target.value)}
        className="mb-2 w-full rounded-md border border-border-medium bg-surface-primary px-2.5 py-1.5 text-sm text-text-primary focus:border-blue-500 focus:outline-none"
      >
        {SCHEDULE_PRESETS.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>

      {isCustom && (
        <div className="mb-2">
          <input
            type="text"
            value={customCron}
            onChange={(e) => setCustomCron(e.target.value)}
            placeholder="*/30 * * * *"
            className="w-full rounded-md border border-border-medium bg-surface-primary px-2.5 py-1.5 font-mono text-sm text-text-primary placeholder:text-text-tertiary focus:border-blue-500 focus:outline-none"
          />
          <p className="mt-1 text-xs text-text-tertiary">
            Five values: minute, hour, day-of-month, month, day-of-week (use{' '}
            <span className="font-mono">*</span> for “any”). Example:{' '}
            <span className="font-mono">0 9 * * 1</span> runs at 9:00 AM every Monday.
          </p>
        </div>
      )}

      <label className="mb-1 block text-xs font-medium text-text-secondary">Deliver result to</label>
      <select
        value={deliveryTarget}
        onChange={(e) => setDeliveryTarget(e.target.value as TCoworkDeliveryTarget)}
        className="mb-3 w-full rounded-md border border-border-medium bg-surface-primary px-2.5 py-1.5 text-sm text-text-primary focus:border-blue-500 focus:outline-none"
      >
        {DELIVERY_OPTIONS.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>

      <label className="mb-3 flex cursor-pointer items-start gap-2">
        <input
          type="checkbox"
          checked={autoApprove}
          onChange={(e) => setAutoApprove(e.target.checked)}
          className="mt-0.5 size-3.5 flex-none accent-amber-500"
        />
        <span className="text-xs text-text-secondary">
          Auto-approve connector writes
          <span className="mt-0.5 block text-text-tertiary">
            Off by default, scheduled runs can’t publish/send/update on connectors. Turn on only if
            you want this routine to make those changes automatically, with no review.
          </span>
        </span>
      </label>

      {error && (
        <div className="mb-2 flex items-start gap-1.5 text-xs text-red-400">
          <AlertCircle className="mt-0.5 size-3.5 flex-none" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-2.5 py-1.5 text-sm text-text-secondary hover:bg-surface-tertiary"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={createMutation.isLoading}
          className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {createMutation.isLoading && <Loader2 className="size-3.5 animate-spin" />}
          Create routine
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Routine row
// ---------------------------------------------------------------------------

function StatusBadge({ routine }: { routine: TCoworkRoutine }) {
  if (routine.lastStatus === 'running') {
    return (
      <span className="flex items-center gap-1 text-xs text-text-tertiary">
        <Loader2 className="size-3 animate-spin" /> Running
      </span>
    );
  }
  if (routine.lastStatus === 'success') {
    return (
      <span className="flex items-center gap-1 text-xs text-green-400">
        <CheckCircle2 className="size-3" /> Last run ok
      </span>
    );
  }
  if (routine.lastStatus === 'error') {
    return (
      <span
        className="flex items-center gap-1 text-xs text-red-400"
        title={routine.lastError || 'Run failed'}
      >
        <AlertCircle className="size-3" /> Last run failed
      </span>
    );
  }
  return <span className="text-xs text-text-tertiary">Never run</span>;
}

function RunHistory({ projectId, routineId }: { projectId: string; routineId: string }) {
  const navigate = useNavigate();
  const runsQuery = useCoworkRoutineRunsQuery(routineId);

  if (runsQuery.isLoading) {
    return <p className="px-1 py-2 text-xs text-text-tertiary">Loading runs…</p>;
  }
  const runs = runsQuery.data ?? [];
  if (runs.length === 0) {
    return <p className="px-1 py-2 text-xs text-text-tertiary">No runs yet.</p>;
  }

  const openOutput = (run: TCoworkRoutineRun) => {
    if (run.conversationId) {
      navigate(`/cowork/${projectId}?convo=${encodeURIComponent(run.conversationId)}`);
    }
  };

  return (
    <ul className="mt-1 flex flex-col gap-1">
      {runs.map((run) => (
        <li
          key={run._id}
          className="flex items-center justify-between gap-2 rounded-md bg-surface-primary px-2 py-1.5"
        >
          <div className="flex min-w-0 items-center gap-1.5">
            {run.status === 'success' ? (
              <CheckCircle2 className="size-3 flex-none text-green-400" />
            ) : run.status === 'error' ? (
              <AlertCircle className="size-3 flex-none text-red-400" />
            ) : (
              <Loader2 className="size-3 flex-none animate-spin text-text-tertiary" />
            )}
            <span className="truncate text-xs text-text-secondary" title={run.error || ''}>
              {formatWhen(run.startedAt)}
              {run.durationMs != null ? ` · ${formatDuration(run.durationMs)}` : ''}
              {run.trigger === 'scheduled' ? ' · scheduled' : ' · manual'}
            </span>
          </div>
          <div className="flex flex-none items-center gap-1">
            {run.deliveredPath && (
              <span
                className="flex items-center gap-0.5 text-xs text-text-tertiary"
                title={`Saved to ${run.deliveredPath}`}
              >
                <FileText className="size-3" />
              </span>
            )}
            {run.conversationId && (
              <button
                type="button"
                onClick={() => openOutput(run)}
                title="Open this run's output"
                className="flex items-center gap-0.5 rounded px-1 py-0.5 text-xs text-blue-400 hover:bg-surface-tertiary"
              >
                <ExternalLink className="size-3" /> Output
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function RoutineRow({ projectId, routine }: { projectId: string; routine: TCoworkRoutine }) {
  const updateMutation = useUpdateCoworkRoutineMutation(projectId);
  const deleteMutation = useDeleteCoworkRoutineMutation(projectId);
  const runMutation = useRunCoworkRoutineMutation(projectId);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showRuns, setShowRuns] = useState(false);
  const isRunning = runMutation.isLoading && runMutation.variables === routine._id;

  const toggleEnabled = () => {
    updateMutation.mutate({ routineId: routine._id, payload: { enabled: !routine.enabled } });
  };

  return (
    <div className="rounded-lg border border-border-medium bg-surface-secondary px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-text-primary">{routine.name}</div>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-text-tertiary">
            <span className="flex items-center gap-1">
              <Clock className="size-3" />
              {describeSchedule(routine.cronExpression)}
            </span>
            {routine.deliveryTarget === 'file' && (
              <span className="flex items-center gap-1" title="Each run is also saved as a workspace file">
                <FileText className="size-3" /> file
              </span>
            )}
            <button
              type="button"
              onClick={() =>
                updateMutation.mutate({
                  routineId: routine._id,
                  payload: { autoApprove: !routine.autoApprove },
                })
              }
              disabled={updateMutation.isLoading}
              title={
                routine.autoApprove
                  ? 'Connector writes run automatically on this routine. Click to require manual handling instead.'
                  : 'Connector writes are withheld on automated runs. Click to auto-approve them (risky).'
              }
              className={`flex items-center gap-1 rounded px-1 py-0.5 disabled:opacity-50 ${
                routine.autoApprove
                  ? 'text-amber-500 hover:bg-amber-500/10'
                  : 'text-text-tertiary hover:bg-surface-tertiary'
              }`}
            >
              <AlertCircle className="size-3" />
              {routine.autoApprove ? 'auto-writes on' : 'auto-writes off'}
            </button>
          </div>
        </div>
        {/* enable toggle */}
        <button
          type="button"
          onClick={toggleEnabled}
          disabled={updateMutation.isLoading || !routine.cronExpression}
          title={
            !routine.cronExpression
              ? 'Manual-only routines have no schedule to enable'
              : routine.enabled
                ? 'Disable schedule'
                : 'Enable schedule'
          }
          className={`flex-none rounded-full px-2 py-0.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            routine.enabled && routine.cronExpression
              ? 'bg-blue-500/20 text-blue-400'
              : 'bg-surface-tertiary text-text-tertiary'
          }`}
        >
          {routine.enabled && routine.cronExpression ? 'Enabled' : 'Disabled'}
        </button>
      </div>

      {routine.disabledReason && (
        <div className="mt-1.5 flex items-start gap-1.5 rounded-md bg-red-500/10 px-2 py-1.5 text-xs text-red-400">
          <AlertCircle className="mt-0.5 size-3 flex-none" />
          <span>{routine.disabledReason} Re-enable to reset.</span>
        </div>
      )}

      <p className="mt-1.5 line-clamp-2 text-xs text-text-secondary">{routine.prompt}</p>

      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <StatusBadge routine={routine} />
          {routine.enabled && routine.cronExpression && (
            <span className="text-xs text-text-tertiary">Next: {formatWhen(routine.nextRun)}</span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => runMutation.mutate(routine._id)}
            disabled={isRunning}
            title="Run now"
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-text-secondary hover:bg-surface-tertiary hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isRunning ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Play className="size-3.5" />
            )}
            Run now
          </button>

          {confirmDelete ? (
            <button
              type="button"
              onClick={() => deleteMutation.mutate(routine._id)}
              disabled={deleteMutation.isLoading}
              className="rounded-md px-2 py-1 text-xs font-medium text-red-400 hover:bg-red-500/10"
            >
              Confirm
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              onBlur={() => setConfirmDelete(false)}
              title="Delete routine"
              className="flex-none rounded-md p-1 text-text-tertiary hover:bg-surface-tertiary hover:text-red-400"
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {runMutation.isError && runMutation.variables === routine._id && (
        <p className="mt-1.5 text-xs text-red-400">Run failed to start. Try again.</p>
      )}

      <div className="mt-2 border-t border-border-medium pt-1.5">
        <button
          type="button"
          onClick={() => setShowRuns((v) => !v)}
          className="flex items-center gap-1 text-xs text-text-tertiary hover:text-text-secondary"
        >
          {showRuns ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
          Recent runs
        </button>
        {showRuns && <RunHistory projectId={projectId} routineId={routine._id} />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

export default function CoworkRoutinesPanel({ projectId }: { projectId: string }) {
  const routinesQuery = useCoworkRoutinesQuery(projectId);
  const [showCreate, setShowCreate] = useState(false);

  if (routinesQuery.isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-text-tertiary">
        Loading routines…
      </div>
    );
  }

  if (routinesQuery.isError) {
    return (
      <div className="flex h-full items-center justify-center px-4 text-center text-sm text-red-400">
        Failed to load routines.
      </div>
    );
  }

  const routines = routinesQuery.data ?? [];

  return (
    <div className="flex h-full flex-col overflow-y-auto px-3 py-3">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-text-tertiary">
          Saved prompts that run on a schedule, hands-free.
        </p>
        {!showCreate && (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="flex flex-none items-center gap-1 rounded-md bg-surface-tertiary px-2 py-1 text-xs font-medium text-text-secondary hover:text-text-primary"
          >
            <Plus className="size-3.5" /> New
          </button>
        )}
      </div>

      {showCreate && (
        <CreateRoutineForm projectId={projectId} onClose={() => setShowCreate(false)} />
      )}

      <div className="flex flex-col gap-2">
        {routines.map((routine) => (
          <RoutineRow key={routine._id} projectId={projectId} routine={routine} />
        ))}
        {routines.length === 0 && !showCreate && (
          <p className="mt-6 text-center text-sm text-text-tertiary">
            No routines yet. Create one to run a prompt on a schedule.
          </p>
        )}
      </div>
    </div>
  );
}
