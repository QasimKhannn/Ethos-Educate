import { Check, LoaderCircle, Wrench } from 'lucide-react';
import { Checkbox } from '@librechat/client';
import { useLocalize } from '~/hooks';

type AgentToolLibraryItemProps = {
  description: string;
  icon: string;
  isPreparing: boolean;
  isSelected: boolean;
  name: string;
  onToggle: () => void;
  providerName: string;
  toolId: string;
};

export default function AgentToolLibraryItem({
  description,
  icon,
  isPreparing,
  isSelected,
  name,
  onToggle,
  providerName,
  toolId,
}: AgentToolLibraryItemProps) {
  const localize = useLocalize();

  return (
    <label
      className={`flex min-h-36 cursor-pointer flex-col rounded-xl border p-4 transition-colors ${
        isSelected
          ? 'border-blue-500/60 bg-blue-500/5'
          : 'border-border-medium bg-surface-primary hover:border-border-heavy'
      } ${isPreparing ? 'cursor-wait opacity-75' : ''}`}
      htmlFor={toolId}
    >
      <div className="flex items-start gap-3">
        <Checkbox
          id={toolId}
          checked={isSelected}
          disabled={isPreparing}
          onCheckedChange={onToggle}
          aria-label={localize('com_ui_agent_tool_picker_toggle_tool', { 0: name })}
          className="mt-0.5 h-5 w-5 shrink-0 rounded border-border-medium"
        />
        <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border-medium bg-surface-tertiary text-text-secondary">
          {icon ? (
            <img src={icon} alt="" className="h-full w-full object-cover" />
          ) : (
            <Wrench className="h-4 w-4" aria-hidden="true" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold leading-5 text-text-primary">{name}</p>
            {isSelected && !isPreparing ? (
              <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-blue-700 dark:text-blue-300">
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                {localize('com_ui_agent_tool_picker_added')}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs font-medium text-text-tertiary">
            {localize('com_ui_agent_tool_picker_provider', { 0: providerName })}
          </p>
          {description ? (
            <p className="mt-2 line-clamp-3 text-sm leading-5 text-text-secondary">{description}</p>
          ) : null}
        </div>
      </div>
      {isPreparing ? (
        <div className="mt-auto flex items-center gap-2 pt-3 text-xs font-medium text-text-secondary">
          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
          {localize('com_ui_agent_tool_picker_preparing')}
        </div>
      ) : null}
    </label>
  );
}

type ToolProviderSetupCardProps = {
  description: string;
  isPreparing: boolean;
  name: string;
  onPrepare: () => void;
};

export function ToolProviderSetupCard({
  description,
  isPreparing,
  name,
  onPrepare,
}: ToolProviderSetupCardProps) {
  const localize = useLocalize();

  return (
    <div className="flex min-h-44 flex-col rounded-xl border border-dashed border-border-heavy bg-surface-primary p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-tertiary text-text-secondary">
          <Wrench className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-text-primary">
            {localize('com_ui_agent_tool_picker_prepare_title', { 0: name })}
          </p>
          <p className="mt-1 text-sm leading-5 text-text-secondary">
            {description || localize('com_ui_agent_tool_picker_prepare_description')}
          </p>
        </div>
      </div>
      <button
        className="btn btn-neutral border-token-border-light mt-auto w-full justify-center"
        type="button"
        onClick={onPrepare}
        disabled={isPreparing}
      >
        {isPreparing ? (
          <>
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
            {localize('com_ui_agent_tool_picker_preparing')}
          </>
        ) : (
          localize('com_ui_agent_tool_picker_prepare_action')
        )}
      </button>
    </div>
  );
}
