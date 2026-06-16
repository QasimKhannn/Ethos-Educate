// cowork — Skills panel: toggle builtin document skills (DOCX / PDF / PPTX / XLSX)
// for a Cowork project. Enabled skills are injected into the agent's system prompt
// at run time so the agent knows how to produce each file type.
import { useQueryClient } from '@tanstack/react-query';
import { QueryKeys } from 'librechat-data-provider';
import type { TCoworkSkill } from 'librechat-data-provider';
import { useCoworkSkillsQuery } from '~/data-provider';
import { useUpdateCoworkProjectMutation } from '~/data-provider';

/** Icon labels keyed by skill id (fallback to id if missing). */
const SKILL_ICONS: Record<string, string> = {
  docx: '📝',
  pdf: '📄',
  pptx: '📊',
  xlsx: '📈',
};

function SkillCard({
  skill,
  onToggle,
  disabled,
}: {
  skill: TCoworkSkill;
  onToggle: (id: string, enabled: boolean) => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onToggle(skill.id, !skill.enabled)}
      className={`flex w-full items-start gap-3 rounded-lg border px-3 py-3 text-left transition-colors ${
        skill.enabled
          ? 'border-blue-500/50 bg-blue-500/10 hover:bg-blue-500/15'
          : 'border-border-medium bg-surface-secondary hover:bg-surface-tertiary'
      } disabled:cursor-not-allowed disabled:opacity-50`}
    >
      <span className="mt-0.5 text-lg leading-none" aria-hidden>
        {SKILL_ICONS[skill.id] ?? '🔧'}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span
            className={`text-sm font-medium ${skill.enabled ? 'text-text-primary' : 'text-text-secondary'}`}
          >
            {skill.name}
          </span>
          {/* toggle indicator */}
          <span
            className={`flex-none rounded-full px-1.5 py-0.5 text-xs font-medium ${
              skill.enabled
                ? 'bg-blue-500/20 text-blue-400'
                : 'bg-surface-tertiary text-text-tertiary'
            }`}
          >
            {skill.enabled ? 'On' : 'Off'}
          </span>
        </div>
        {skill.description && (
          <p className="mt-0.5 text-xs text-text-tertiary line-clamp-2">{skill.description}</p>
        )}
      </div>
    </button>
  );
}

export default function CoworkSkillsPanel({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const skillsQuery = useCoworkSkillsQuery(projectId);
  const updateMutation = useUpdateCoworkProjectMutation(projectId);

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

  return (
    <div className="flex h-full flex-col overflow-y-auto px-3 py-3">
      <p className="mb-3 text-xs text-text-tertiary">
        Toggle skills to give the agent instructions for creating each file type. Enabled skills
        are injected into every message in this project.
      </p>
      <div className="flex flex-col gap-2">
        {skills.map((skill) => (
          <SkillCard
            key={skill.id}
            skill={skill}
            onToggle={handleToggle}
            disabled={updateMutation.isLoading}
          />
        ))}
        {skills.length === 0 && (
          <p className="text-center text-sm text-text-tertiary">No skills available.</p>
        )}
      </div>
    </div>
  );
}
