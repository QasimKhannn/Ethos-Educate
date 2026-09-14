import { useEffect, useMemo } from 'react';
import { Switch } from '@librechat/client';
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import type { AgentRecommendedPrompt } from 'librechat-data-provider';
import type { AgentForm } from '~/common';
import { cn, defaultTextProps, removeFocusOutlines } from '~/utils';
import { useLocalize } from '~/hooks';

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
    <details className="agent-builder-optional-settings agent-builder-recommended-prompts">
      <summary>
        <span>
          {localize('com_ui_agent_recommended_prompts')}
          <span className="agent-builder-disclosure-status">
            {localize('com_ui_agent_builder_optional_status')}
          </span>
        </span>
        <small>{localize('com_ui_agent_recommended_prompts_help')}</small>
      </summary>
      <div className="agent-builder-optional-settings-body agent-builder-recommended-prompts-body">
        <Controller
          name="show_recommended_prompts"
          control={control}
          render={({ field }) => (
            <div className="agent-builder-recommended-prompts-toggle">
              <label htmlFor="show-recommended-prompts">
                {localize('com_ui_agent_recommended_prompts_toggle')}
              </label>
              <Switch
                id="show-recommended-prompts"
                checked={field.value !== false}
                onCheckedChange={field.onChange}
                data-testid="show-recommended-prompts"
                aria-label={localize('com_ui_agent_recommended_prompts_toggle')}
              />
            </div>
          )}
        />
        <div className="agent-builder-recommended-prompts-grid">
          {promptRows.map((_, index) => (
            <div key={index} className="agent-builder-recommended-prompt-card">
              <div className="agent-builder-recommended-prompt-card-title">
                {localize('com_ui_agent_recommended_prompt_card', { 0: index + 1 })}
              </div>
              <div className="agent-builder-recommended-prompt-fields">
                <label>
                  <span>{localize('com_ui_agent_recommended_prompt_label')}</span>
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
                </label>
                <label>
                  <span>{localize('com_ui_agent_recommended_prompt_description')}</span>
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
                </label>
                <label className="agent-builder-recommended-prompt-full">
                  <span>{localize('com_ui_agent_recommended_prompt_prompt')}</span>
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
                </label>
              </div>
            </div>
          ))}
        </div>
      </div>
    </details>
  );
}
