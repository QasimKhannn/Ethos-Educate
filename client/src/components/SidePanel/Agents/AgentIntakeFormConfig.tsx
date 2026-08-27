/* eslint-disable i18next/no-literal-string */

import { Controller, useFormContext } from 'react-hook-form';
import type { AgentForm } from '~/common';
import { cn, defaultTextProps, removeFocusOutlines } from '~/utils';
import AgentFieldLabel from './AgentFieldLabel';

const inputClass = cn(
  defaultTextProps,
  'flex w-full px-3 py-2 border-border-light bg-surface-secondary focus-visible:ring-2 focus-visible:ring-ring-primary',
  removeFocusOutlines,
);

/** Selects a teacher-facing structured request form for this agent. */
export default function AgentIntakeFormConfig() {
  const { control } = useFormContext<AgentForm>();

  return (
    <div className="mb-4">
      <AgentFieldLabel
        htmlFor="agent-intake-form"
        label="Teacher request form"
        description="Shown before a teacher starts a chat with this agent."
      />
      <Controller
        name="intake_form"
        control={control}
        render={({ field }) => (
          <select
            id="agent-intake-form"
            className={cn(inputClass, 'h-10 rounded-lg')}
            value={field.value?.template ?? ''}
            onChange={(event) => {
              const template = event.target.value;
              field.onChange(template ? { template } : undefined);
            }}
          >
            <option value="">No form</option>
            <option value="worksheet">Worksheet setup</option>
            <option value="assessment">Assessment setup</option>
            <option value="presentation">Presentation template picker</option>
          </select>
        )}
      />
    </div>
  );
}
