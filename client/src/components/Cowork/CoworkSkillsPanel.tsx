// cowork — Skills panel: toggle builtin document skills (DOCX / PDF / PPTX / XLSX) AND
// the user's own custom skills for a Cowork project. Enabled skills are injected into the
// agent's system prompt at run time. A2 adds per-user custom skills (create / delete);
// they're user-scoped and enabled per-project via the id form `custom:<id>`.
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Puzzle, X, Trash2, Plus } from 'lucide-react';
import { QueryKeys } from 'librechat-data-provider';
import type { TCoworkSkill } from 'librechat-data-provider';
import {
  useCoworkSkillsQuery,
  useUpdateCoworkProjectMutation,
  useCreateCoworkSkillMutation,
  useDeleteCoworkSkillMutation,
} from '~/data-provider';

/** Icon labels keyed by builtin skill id (fallback for custom / unknown). */
const SKILL_ICONS: Record<string, string> = {
  docx: '📝',
  pdf: '📄',
  pptx: '📊',
  xlsx: '📈',
};

function skillIcon(skill: TCoworkSkill): string {
  if (skill.source === 'custom') {
    return '✨';
  }
  return SKILL_ICONS[skill.id] ?? '🔧';
}

function SkillCard({
  skill,
  onToggle,
  onDelete,
  disabled,
}: {
  skill: TCoworkSkill;
  onToggle: (id: string, enabled: boolean) => void;
  onDelete: (skill: TCoworkSkill) => void;
  disabled: boolean;
}) {
  const isCustom = skill.source === 'custom';
  return (
    <div
      className={`flex w-full items-start gap-2 rounded-lg border px-3 py-3 transition-colors ${
        skill.enabled
          ? 'border-blue-500/50 bg-blue-500/10'
          : 'border-border-medium bg-surface-secondary'
      }`}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => onToggle(skill.id, !skill.enabled)}
        className="flex min-w-0 flex-1 items-start gap-3 text-left disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="mt-0.5 text-lg leading-none" aria-hidden>
          {skillIcon(skill)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={`truncate text-sm font-medium ${skill.enabled ? 'text-text-primary' : 'text-text-secondary'}`}
            >
              {skill.name}
            </span>
            <span
              className={`flex-none rounded-full px-1.5 py-0.5 text-xs font-medium ${
                skill.enabled
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'bg-surface-tertiary text-text-tertiary'
              }`}
            >
              {skill.enabled ? 'On' : 'Off'}
            </span>
            {isCustom && (
              <span className="flex-none rounded bg-surface-tertiary px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-text-tertiary">
                Custom
              </span>
            )}
          </div>
          {skill.description && (
            <p className="mt-0.5 text-xs text-text-tertiary line-clamp-2">{skill.description}</p>
          )}
        </div>
      </button>
      {isCustom && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onDelete(skill)}
          title="Delete skill"
          aria-label="Delete skill"
          className="flex-none rounded p-1 text-text-tertiary hover:bg-surface-tertiary hover:text-red-400 disabled:opacity-50"
        >
          <Trash2 className="size-3.5" />
        </button>
      )}
    </div>
  );
}

export default function CoworkSkillsPanel({
  projectId,
  locked = false,
}: {
  projectId: string;
  /** When true (a chat has started), skill changes are disabled to avoid confusion —
   * skills are injected at run start, so changes should be made before chatting. */
  locked?: boolean;
}) {
  const queryClient = useQueryClient();
  const skillsQuery = useCoworkSkillsQuery(projectId);
  const updateMutation = useUpdateCoworkProjectMutation(projectId);
  const createMutation = useCreateCoworkSkillMutation();
  const deleteMutation = useDeleteCoworkSkillMutation();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', content: '' });
  const [formError, setFormError] = useState<string | null>(null);

  const handleToggle = (skillId: string, newEnabled: boolean) => {
    const current = skillsQuery.data ?? [];
    const currentEnabled = current.filter((s) => s.enabled).map((s) => s.id);
    const nextEnabled = newEnabled
      ? [...new Set([...currentEnabled, skillId])]
      : currentEnabled.filter((id) => id !== skillId);

    // Optimistic update so the toggle feels instant.
    queryClient.setQueryData<TCoworkSkill[]>(
      [QueryKeys.coworkSkills, projectId],
      (prev) => prev?.map((s) => (s.id === skillId ? { ...s, enabled: newEnabled } : s)) ?? [],
    );

    updateMutation.mutate(
      { enabledSkills: nextEnabled },
      {
        onError: () => {
          // Roll back the optimistic update on failure.
          queryClient.invalidateQueries([QueryKeys.coworkSkills, projectId]);
        },
      },
    );
  };

  const handleCreate = () => {
    setFormError(null);
    if (!form.name.trim() || !form.content.trim()) {
      setFormError('A name and the instructions are both required.');
      return;
    }
    createMutation.mutate(
      {
        name: form.name.trim(),
        description: form.description.trim(),
        content: form.content.trim(),
      },
      {
        onSuccess: () => {
          setForm({ name: '', description: '', content: '' });
          setShowForm(false);
        },
        onError: (err: unknown) => {
          const message =
            (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
            'Failed to create skill.';
          setFormError(message);
        },
      },
    );
  };

  const handleDelete = (skill: TCoworkSkill) => {
    if (!skill.skillId) {
      return;
    }
    if (!window.confirm(`Delete the custom skill “${skill.name}”? This cannot be undone.`)) {
      return;
    }
    deleteMutation.mutate(skill.skillId);
  };

  if (skillsQuery.isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-text-tertiary">
        Loading skills…
      </div>
    );
  }

  if (skillsQuery.isError) {
    return (
      <div className="flex h-full items-center justify-center px-4 text-center text-sm text-red-400">
        Failed to load skills.
      </div>
    );
  }

  const skills = skillsQuery.data ?? [];
  const busy = updateMutation.isLoading || deleteMutation.isLoading;

  return (
    <div className="flex h-full flex-col overflow-y-auto px-3 py-3">
      <p className="mb-3 text-xs text-text-tertiary">
        Toggle skills to give the agent instructions it follows in this project. Enabled skills are
        injected into every message.{!locked && ' Add your own custom skills below.'}
      </p>
      {locked && (
        <div className="mb-3 rounded-md border border-border-medium bg-surface-secondary px-3 py-2 text-xs text-text-tertiary">
          Chat in progress — start a new chat to change skills.
        </div>
      )}
      <div className="flex flex-col gap-2">
        {skills.map((skill) => (
          <SkillCard
            key={skill.id}
            skill={skill}
            onToggle={handleToggle}
            onDelete={handleDelete}
            disabled={busy || locked}
          />
        ))}
        {skills.length === 0 && (
          <p className="text-center text-sm text-text-tertiary">No skills available.</p>
        )}
      </div>

      {/* Add custom skill — hidden once a chat has started (locked) to avoid confusion. */}
      {!locked && (
      <div className="mt-4 border-t border-border-medium pt-3">
        {!showForm ? (
          <button
            type="button"
            onClick={() => {
              setShowForm(true);
              setFormError(null);
            }}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border-medium px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-surface-secondary hover:text-text-primary"
          >
            <Plus className="size-4" /> Add custom skill
          </button>
        ) : (
          <div className="flex flex-col gap-2 rounded-lg border border-border-medium bg-surface-secondary p-3">
            <p className="text-xs font-medium text-text-secondary">New custom skill</p>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Name (e.g. Lesson plan format)"
              className="w-full rounded-md border border-border-medium bg-surface-primary px-2.5 py-1.5 text-sm text-text-primary placeholder:text-text-tertiary focus:border-blue-500 focus:outline-none"
            />
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Short description (optional)"
              className="w-full rounded-md border border-border-medium bg-surface-primary px-2.5 py-1.5 text-sm text-text-primary placeholder:text-text-tertiary focus:border-blue-500 focus:outline-none"
            />
            <textarea
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              placeholder="Instructions the coworker should follow (Markdown). e.g. 'When asked for a lesson plan, always include Objectives, Materials, Steps, and Assessment sections.'"
              rows={6}
              className="w-full resize-y rounded-md border border-border-medium bg-surface-primary px-2.5 py-1.5 text-sm text-text-primary placeholder:text-text-tertiary focus:border-blue-500 focus:outline-none"
            />
            {formError && <p className="text-xs text-red-400">{formError}</p>}
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setFormError(null);
                  setForm({ name: '', description: '', content: '' });
                }}
                className="rounded-md px-2.5 py-1.5 text-sm text-text-secondary hover:bg-surface-tertiary hover:text-text-primary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={createMutation.isLoading}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {createMutation.isLoading ? 'Adding…' : 'Add skill'}
              </button>
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  );
}

// cowork — Skills as a modal overlay (opened from the left rail), mirroring the Connectors
// modal so opening Skills doesn't navigate/remount the chat. Reuses the same panel body.
export function CoworkSkillsModal({
  projectId,
  onClose,
  locked = false,
}: {
  projectId: string;
  onClose: () => void;
  locked?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 duration-200 animate-in fade-in-0"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="flex h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border-medium bg-surface-primary shadow-xl duration-200 animate-in fade-in-0 zoom-in-95">
        <div className="flex flex-none items-center justify-between border-b border-border-medium px-4 py-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-text-primary">
              <Puzzle className="size-4 text-text-info" /> Skills
            </p>
            <p className="mt-0.5 text-xs text-text-tertiary">
              Toggle skills the coworker can use in this project (Agent mode).
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex-none rounded-md p-1.5 text-text-secondary hover:bg-surface-secondary hover:text-text-primary"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">
          <CoworkSkillsPanel projectId={projectId} locked={locked} />
        </div>
      </div>
    </div>
  );
}
