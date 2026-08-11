import { useEffect, useMemo } from 'react';
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import type { AgentRecommendedPrompt } from 'librechat-data-provider';
import type { AgentForm } from '~/common';
import { cn, defaultTextProps, removeFocusOutlines } from '~/utils';
import { useLocalize } from '~/hooks';
import AgentFieldLabel from './AgentFieldLabel';

const promptCount = 3;

const inputClass = cn(
  defaultTextProps,
  'flex w-full px-3 py-2 border-border-light bg-surface-secondary focus-visible:ring-2 focus-visible:ring-ring-primary',
  removeFocusOutlines,
);

const getPromptRows = (
  prompts?: AgentRecommendedPrompt[] | null,
): Array<AgentRecommendedPrompt & { description: string }> =>
  Array.from({ length: promptCount }, (_, index) => {
    const prompt = prompts?.[index];
    return {
      label: prompt?.label ?? '',
      prompt: prompt?.prompt ?? '',
      description: prompt?.description ?? '',
    };
  });

export default function RecommendedPrompts() {
  const localize = useLocalize();
  const { control, setValue } = useFormContext<AgentForm>();
  const watchedPrompts = useWatch({ control, name: 'recommended_prompts' });
  const promptRows = useMemo(() => getPromptRows(watchedPrompts), [watchedPrompts]);

  useEffect(() => {
    if (Array.isArray(watchedPrompts) && watchedPrompts.length === promptCount) {
      return;
    }

    setValue('recommended_prompts', promptRows, { shouldDirty: false });
  }, [promptRows, setValue, watchedPrompts]);

  return (
    <div className="mb-4">
      <div className="mb-3 flex items-start justify-between gap-4">
        <AgentFieldLabel
          label={localize('com_ui_agent_recommended_prompts')}
          description={localize('com_ui_agent_recommended_prompts_help')}
        />
        <Controller
          name="show_recommended_prompts"
          control={control}
          render={({ field }) => (
            <label
              htmlFor="show-recommended-prompts"
              className="flex shrink-0 cursor-pointer items-center gap-2 text-sm font-medium text-text-secondary"
            >
              <input
                id="show-recommended-prompts"
                type="checkbox"
                checked={field.value !== false}
                onChange={(event) => field.onChange(event.target.checked)}
                className="h-4 w-4 rounded border-border-medium text-blue-600 focus:ring-ring-primary"
                aria-label={localize('com_ui_agent_recommended_prompts_toggle')}
              />
              <span>{localize('com_ui_agent_recommended_prompts_toggle')}</span>
            </label>
          )}
        />
      </div>
      <div className="grid gap-3">
        {promptRows.map((_, index) => (
          <div
            key={index}
            className="rounded-lg border border-border-light bg-surface-primary/70 p-3"
          >
            <div className="mb-2 text-sm font-medium text-text-primary">
              {localize('com_ui_agent_recommended_prompt_card', { 0: index + 1 })}
            </div>
            <div className="grid gap-2">
              <Controller
                name={`recommended_prompts.${index}.label`}
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    value={field.value ?? ''}
                    maxLength={90}
                    className={inputClass}
                    placeholder={localize('com_ui_agent_recommended_prompt_label_placeholder')}
                    aria-label={localize('com_ui_agent_recommended_prompt_label')}
                  />
                )}
              />
              <Controller
                name={`recommended_prompts.${index}.description`}
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    value={field.value ?? ''}
                    maxLength={160}
                    className={inputClass}
                    placeholder={localize(
                      'com_ui_agent_recommended_prompt_description_placeholder',
                    )}
                    aria-label={localize('com_ui_agent_recommended_prompt_description')}
                  />
                )}
              />
              <Controller
                name={`recommended_prompts.${index}.prompt`}
                control={control}
                render={({ field }) => (
                  <textarea
                    {...field}
                    value={field.value ?? ''}
                    maxLength={1200}
                    rows={2}
                    className={cn(inputClass, 'min-h-16 resize-y')}
                    placeholder={localize('com_ui_agent_recommended_prompt_prompt_placeholder')}
                    aria-label={localize('com_ui_agent_recommended_prompt_prompt')}
                  />
                )}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
