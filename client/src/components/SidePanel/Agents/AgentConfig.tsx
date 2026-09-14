import React, { useState } from 'react';
import { Controller, useWatch, useFormContext } from 'react-hook-form';
import { EModelEndpoint } from 'librechat-data-provider';
import type { AgentForm } from '~/common';
import { removeFocusOutlines, defaultTextProps, cn } from '~/utils';
import { MCPToolSelectDialog } from '~/components/Tools';
import { useAgentPanelContext } from '~/Providers';
import { useLocalize, useVisibleTools } from '~/hooks';
import Instructions from './Instructions';
import AgentAvatar from './AgentAvatar';
import MCPTools from './MCPTools';
import AgentFieldLabel from './AgentFieldLabel';
import RecommendedPrompts from './RecommendedPrompts';
import AgentCategorySelector from './AgentCategorySelector';

const inputClass = cn(
  defaultTextProps,
  'flex w-full px-3 py-2 border-border-light bg-surface-secondary focus-visible:ring-2 focus-visible:ring-ring-primary',
  removeFocusOutlines,
);

export default function AgentConfig() {
  const localize = useLocalize();
  const methods = useFormContext<AgentForm>();
  const [showMCPToolDialog, setShowMCPToolDialog] = useState(false);
  const { regularTools, availableMCPServers, mcpServersMap } = useAgentPanelContext();

  const {
    control,
    formState: { errors },
  } = methods;
  const agent = useWatch({ control, name: 'agent' });
  const tools = useWatch({ control, name: 'tools' });
  const agent_id = useWatch({ control, name: 'id' });

  const showMCPControls = availableMCPServers != null && availableMCPServers.length > 0;

  const { mcpServerNames } = useVisibleTools(tools, regularTools, mcpServersMap);

  return (
    <>
      <div className="agent-builder-form h-auto dark:bg-transparent">
        <section className="agent-builder-section" aria-label={localize('com_ui_agent_avatar')}>
          <div className="agent-builder-avatar-top">
            <AgentAvatar avatar={agent?.['avatar'] ?? null} />
            <div className="agent-builder-avatar-top-copy">
              <AgentFieldLabel
                label={localize('com_ui_agent_avatar')}
                description={localize('com_ui_agent_avatar_description')}
                optional
              />
            </div>
          </div>
        </section>
        <section
          className="agent-builder-section"
          aria-label={localize('com_ui_agent_builder_details_title')}
        >
          <div className="agent-builder-details-grid">
            <div className="agent-builder-field">
              <AgentFieldLabel
                htmlFor="name"
                label={localize('com_ui_name')}
                description={localize('com_ui_agent_name_help')}
                required
              />
              <Controller
                name="name"
                rules={{ required: localize('com_ui_agent_name_is_required') }}
                control={control}
                render={({ field }) => (
                  <>
                    <input
                      {...field}
                      value={field.value ?? ''}
                      maxLength={256}
                      className={inputClass}
                      id="name"
                      type="text"
                      placeholder={localize('com_agents_name_placeholder')}
                      aria-label="Agent name"
                    />
                    <div
                      className={cn(
                        'mt-1 w-56 text-sm text-red-500',
                        errors.name ? 'visible h-auto' : 'invisible h-0',
                      )}
                      role="alert"
                    >
                      {errors.name ? errors.name.message : ' '}
                    </div>
                  </>
                )}
              />
            </div>
            <div className="agent-builder-field">
              <AgentFieldLabel
                label={localize('com_agents_filter_by_category')}
                description={localize('com_ui_agent_category_help')}
                optional
              />
              <AgentCategorySelector className="agent-builder-category-trigger btn btn-neutral border-token-border-light relative h-10 w-full rounded-lg font-medium" />
            </div>
            <div className="agent-builder-field agent-builder-field-full">
              <AgentFieldLabel
                htmlFor="toolkit_description"
                label={localize('com_ui_agent_toolkit_description')}
                description={localize('com_ui_agent_toolkit_description_help')}
                optional
              />
              <Controller
                name="toolkit_description"
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    value={field.value ?? ''}
                    maxLength={180}
                    className={inputClass}
                    id="toolkit_description"
                    type="text"
                    placeholder={localize('com_agents_toolkit_description_placeholder')}
                    aria-label={localize('com_ui_agent_toolkit_description')}
                  />
                )}
              />
            </div>
            <div className="agent-builder-field agent-builder-field-full">
              <AgentFieldLabel
                htmlFor="description"
                label={localize('com_ui_agent_landing_description')}
                description={localize('com_ui_agent_landing_description_help')}
                optional
              />
              <Controller
                name="description"
                control={control}
                render={({ field }) => (
                  <textarea
                    {...field}
                    value={field.value ?? ''}
                    maxLength={1200}
                    rows={3}
                    className={cn(inputClass, 'min-h-24 resize-y')}
                    id="description"
                    placeholder={localize('com_agents_description_placeholder')}
                    aria-label={localize('com_ui_agent_landing_description')}
                  />
                )}
              />
            </div>
          </div>
          <RecommendedPrompts />
        </section>
        <section
          className="agent-builder-section"
          aria-label={localize('com_ui_agent_builder_behavior_title')}
        >
          <Instructions />
        </section>
        {showMCPControls && (
          <section className="agent-builder-section" aria-label={localize('com_ui_tools')}>
            <div className="agent-builder-tool-card agent-builder-mcp-setting">
              <MCPTools
                agentId={agent_id}
                mcpServerNames={mcpServerNames}
                setShowMCPToolDialog={setShowMCPToolDialog}
              />
            </div>
          </section>
        )}
      </div>
      {showMCPControls && (
        <MCPToolSelectDialog
          agentId={agent_id}
          isOpen={showMCPToolDialog}
          mcpServerNames={mcpServerNames}
          setIsOpen={setShowMCPToolDialog}
          endpoint={EModelEndpoint.agents}
        />
      )}
    </>
  );
}
