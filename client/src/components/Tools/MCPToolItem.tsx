import { Check, Plus, Wrench, X } from 'lucide-react';
import type { AgentToolType } from 'librechat-data-provider';
import { useLocalize } from '~/hooks';

type MCPToolItemProps = {
  tool: AgentToolType;
  onAddTool: () => void;
  onRemoveTool: () => void;
  isInstalled?: boolean;
  isConfiguring?: boolean;
  isInitializing?: boolean;
};

function MCPToolItem({
  tool,
  onAddTool,
  onRemoveTool,
  isInstalled = false,
  isConfiguring = false,
  isInitializing = false,
}: MCPToolItemProps) {
  const localize = useLocalize();
  const handleClick = () => {
    if (isInstalled) {
      onRemoveTool();
    } else {
      onAddTool();
    }
  };

  const name = tool.metadata?.name || tool.tool_id;
  const description = tool.metadata?.description || '';
  const icon = tool.metadata?.icon;

  // Determine button state and text
  const getButtonState = () => {
    if (isInstalled) {
      return {
        text: localize('com_nav_tool_remove'),
        icon: <X className="flex h-4 w-4 items-center stroke-2" aria-hidden="true" />,
        className: 'btn btn-neutral border-token-border-light relative',
        disabled: false,
      };
    }

    if (isConfiguring) {
      return {
        text: localize('com_ui_confirm'),
        icon: <Plus className="flex h-4 w-4 items-center stroke-2" aria-hidden="true" />,
        className: 'btn btn-primary relative',
        disabled: false,
      };
    }

    if (isInitializing) {
      return {
        text: localize('com_ui_initializing'),
        icon: <Wrench className="flex h-4 w-4 items-center stroke-2" aria-hidden="true" />,
        className: 'btn btn-primary relative opacity-75 cursor-not-allowed',
        disabled: true,
      };
    }

    return {
      text: localize('com_ui_agent_tool_picker_add'),
      icon: <Plus className="flex h-4 w-4 items-center stroke-2" aria-hidden="true" />,
      className: 'btn btn-primary relative',
      disabled: false,
    };
  };

  const buttonState = getButtonState();

  return (
    <div
      className={`flex min-h-[12rem] flex-col gap-4 overflow-hidden rounded-xl border p-4 transition-colors ${
        isInstalled
          ? 'border-blue-500/50 bg-blue-500/5'
          : 'border-border-medium bg-surface-primary hover:border-border-heavy'
      }`}
    >
      <div className="flex min-w-0 gap-3">
        <div className="h-12 w-12 shrink-0">
          <div className="relative h-full w-full">
            {icon ? (
              <img
                src={icon}
                alt={localize('com_ui_logo', { 0: name })}
                className="h-full w-full rounded-[5px] bg-white"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center rounded-lg border border-border-medium bg-surface-tertiary">
                <Wrench className="h-6 w-6 text-text-secondary" />
              </div>
            )}
            <div className="absolute inset-0 rounded-lg ring-1 ring-inset ring-black/10"></div>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="line-clamp-2 max-w-full text-base font-semibold leading-5 text-text-primary">
              {name}
            </div>
            {isInstalled ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-blue-500/10 px-2 py-1 text-xs font-medium text-blue-700 dark:text-blue-300">
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                {localize('com_ui_agent_tool_picker_added')}
              </span>
            ) : null}
          </div>
          {description ? (
            <div className="mt-2 line-clamp-3 text-sm leading-5 text-text-secondary">
              {description}
            </div>
          ) : null}
        </div>
      </div>
      <button
        className={`${buttonState.className} mt-auto w-full justify-center`}
        aria-label={`${buttonState.text} ${name}`}
        onClick={handleClick}
        disabled={buttonState.disabled}
      >
        <div className="flex w-full items-center justify-center gap-2">
          {buttonState.text}
          {buttonState.icon}
        </div>
      </button>
    </div>
  );
}

export default MCPToolItem;
