import React, { useState, useMemo } from 'react';
import { Controller, useWatch, useFormContext } from 'react-hook-form';
import { EModelEndpoint, SystemRoles, getEndpointField } from 'librechat-data-provider';
import type { AgentForm, IconComponentTypes } from '~/common';
import {
  removeFocusOutlines,
  processAgentOption,
  defaultTextProps,
  validateEmail,
  getAgentBuilderModelLabel,
  getAgentBuilderProviderLabel,
  getIconKey,
  cn,
} from '~/utils';
import { MCPToolSelectDialog } from '~/components/Tools';
import useAgentCapabilities from '~/hooks/Agents/useAgentCapabilities';
import { useFileMapContext, useAgentPanelContext } from '~/Providers';
import AgentCategorySelector from './AgentCategorySelector';
import { useAuthContext, useLocalize, useVisibleTools } from '~/hooks';
import { Panel } from '~/common';
import { useGetAgentFiles } from '~/data-provider';
import { icons } from '~/hooks/Endpoint/Icons';
import Instructions from './Instructions';
import AgentAvatar from './AgentAvatar';
import FileContext from './FileContext';
import SearchForm from './Search/Form';
import FileSearch from './FileSearch';
import Artifacts from './Artifacts';
import CodeForm from './Code/Form';
import MCPTools from './MCPTools';
import AgentFieldLabel from './AgentFieldLabel';

const inputClass = cn(
  defaultTextProps,
  'flex w-full px-3 py-2 border-border-light bg-surface-secondary focus-visible:ring-2 focus-visible:ring-ring-primary',
  removeFocusOutlines,
);

export default function AgentConfig() {
  const localize = useLocalize();
  const { user } = useAuthContext();
  const fileMap = useFileMapContext();
  const methods = useFormContext<AgentForm>();
  const [showMCPToolDialog, setShowMCPToolDialog] = useState(false);
  const {
    regularTools,
    agentsConfig,
    availableMCPServers,
    mcpServersMap,
    setActivePanel,
    endpointsConfig,
  } = useAgentPanelContext();

  const {
    control,
    formState: { errors },
  } = methods;
  const provider = useWatch({ control, name: 'provider' });
  const model = useWatch({ control, name: 'model' });
  const agent = useWatch({ control, name: 'agent' });
  const tools = useWatch({ control, name: 'tools' });
  const agent_id = useWatch({ control, name: 'id' });

  const { data: agentFiles = [] } = useGetAgentFiles(agent_id);

  const mergedFileMap = useMemo(() => {
    const newFileMap = { ...fileMap };
    agentFiles.forEach((file) => {
      if (file.file_id) {
        newFileMap[file.file_id] = file;
      }
    });
    return newFileMap;
  }, [fileMap, agentFiles]);

  const { codeEnabled, contextEnabled, artifactsEnabled, webSearchEnabled, fileSearchEnabled } =
    useAgentCapabilities(agentsConfig?.capabilities);
  const showDeveloperControls = user?.role === SystemRoles.ADMIN;
  const showCodeControls = showDeveloperControls && codeEnabled;
  const showMCPControls =
    showDeveloperControls && availableMCPServers != null && availableMCPServers.length > 0;

  const context_files = useMemo(() => {
    if (typeof agent === 'string') {
      return [];
    }

    if (agent?.id !== agent_id) {
      return [];
    }

    if (agent.context_files) {
      return agent.context_files;
    }

    const _agent = processAgentOption({
      agent,
      fileMap: mergedFileMap,
    });
    return _agent.context_files ?? [];
  }, [agent, agent_id, mergedFileMap]);

  const knowledge_files = useMemo(() => {
    if (typeof agent === 'string') {
      return [];
    }

    if (agent?.id !== agent_id) {
      return [];
    }

    if (agent.knowledge_files) {
      return agent.knowledge_files;
    }

    const _agent = processAgentOption({
      agent,
      fileMap: mergedFileMap,
    });
    return _agent.knowledge_files ?? [];
  }, [agent, agent_id, mergedFileMap]);

  const code_files = useMemo(() => {
    if (typeof agent === 'string') {
      return [];
    }

    if (agent?.id !== agent_id) {
      return [];
    }

    if (agent.code_files) {
      return agent.code_files;
    }

    const _agent = processAgentOption({
      agent,
      fileMap: mergedFileMap,
    });
    return _agent.code_files ?? [];
  }, [agent, agent_id, mergedFileMap]);

  const providerValue = typeof provider === 'string' ? provider : provider?.value;
  const providerLabel = getAgentBuilderProviderLabel(providerValue ?? '');
  const modelLabel = getAgentBuilderModelLabel(model);
  let Icon: IconComponentTypes | null | undefined;
  let endpointType: EModelEndpoint | undefined;
  let endpointIconURL: string | undefined;
  let iconKey: string | undefined;

  if (providerValue !== undefined) {
    endpointType = getEndpointField(endpointsConfig, providerValue as string, 'type');
    endpointIconURL = getEndpointField(endpointsConfig, providerValue as string, 'iconURL');
    iconKey = getIconKey({
      endpoint: providerValue as string,
      endpointsConfig,
      endpointType,
      endpointIconURL,
    });
    Icon = icons[iconKey];
  }

  const { mcpServerNames } = useVisibleTools(tools, regularTools, mcpServersMap);
  let modelSelectionLabel = localize('com_ui_select_model');
  if (modelLabel) {
    modelSelectionLabel = modelLabel;
    if (providerLabel) {
      modelSelectionLabel = `${providerLabel} - ${modelLabel}`;
    }
  }

  return (
    <>
      <div className="agent-builder-form h-auto dark:bg-transparent">
        <div className="agent-builder-intro">
          <h3>{localize('com_ui_agent_builder_intro_title')}</h3>
          <p>{localize('com_ui_agent_builder_intro_description')}</p>
          <span className="agent-builder-required-note">
            <span aria-hidden="true">*</span>
            {localize('com_ui_agent_builder_required_note')}
          </span>
        </div>
        <section className="agent-builder-section" aria-labelledby="agent-details-heading">
          <div className="agent-builder-section-heading">
            <h4 id="agent-details-heading">{localize('com_ui_agent_builder_details_title')}</h4>
          </div>
          <div className="mb-4">
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
            <Controller
              name="id"
              control={control}
              render={({ field }) => (
                <p className="h-3 text-xs italic text-text-secondary" aria-live="polite">
                  {field.value}
                </p>
              )}
            />
          </div>
          <div className="mb-4">
            <AgentFieldLabel
              htmlFor="toolkit_description"
              label={localize('com_ui_agent_toolkit_description')}
              description={localize('com_ui_agent_toolkit_description_help')}
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
          <div className="mb-4">
            <AgentFieldLabel
              htmlFor="description"
              label={localize('com_ui_agent_landing_description')}
              description={localize('com_ui_agent_landing_description_help')}
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
          <div className="mb-4">
            <AgentFieldLabel
              htmlFor="category-selector"
              label={localize('com_ui_category')}
              description={localize('com_ui_agent_category_help')}
              required
            />
            <AgentCategorySelector className="w-full" />
          </div>
        </section>
        <section className="agent-builder-section" aria-labelledby="agent-behavior-heading">
          <div className="agent-builder-section-heading">
            <h4 id="agent-behavior-heading">{localize('com_ui_agent_builder_behavior_title')}</h4>
          </div>
          <Instructions />
        </section>
        <section className="agent-builder-section" aria-labelledby="agent-model-heading">
          <div className="agent-builder-section-heading">
            <h4 id="agent-model-heading">{localize('com_ui_agent_builder_model_title')}</h4>
          </div>
          <div className="mb-4">
            <AgentFieldLabel
              htmlFor="provider"
              label={localize('com_ui_model')}
              description={localize('com_ui_agent_model_help')}
              required
            />
            <button
              type="button"
              onClick={() => setActivePanel(Panel.model)}
              className="agent-builder-model-trigger btn btn-neutral border-token-border-light relative h-10 w-full rounded-lg font-medium"
              aria-haspopup="true"
              aria-expanded="false"
            >
              <div className="flex w-full items-center gap-2">
                {Icon && (
                  <div className="shadow-stroke relative flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-white text-black dark:bg-white">
                    <Icon
                      className="h-2/3 w-2/3"
                      endpoint={providerValue as string}
                      endpointType={endpointType}
                      iconURL={endpointIconURL}
                    />
                  </div>
                )}
                <span>{modelSelectionLabel}</span>
              </div>
            </button>
          </div>
        </section>
        <details className="agent-builder-optional-settings">
          <summary>
            <span>{localize('com_ui_agent_optional_settings')}</span>
            <small>{localize('com_ui_agent_optional_settings_description')}</small>
          </summary>
          <div className="agent-builder-optional-settings-body">
            <div className="agent-builder-avatar-setting">
              <AgentFieldLabel
                label={localize('com_ui_agent_avatar')}
                description={localize('com_ui_agent_avatar_help')}
              />
              <AgentAvatar avatar={agent?.['avatar'] ?? null} />
            </div>
            {(showCodeControls ||
              fileSearchEnabled ||
              artifactsEnabled ||
              contextEnabled ||
              webSearchEnabled) && (
              <div className="flex w-full flex-col items-start gap-3">
                <AgentFieldLabel
                  label={localize('com_assistants_capabilities')}
                  description={localize('com_ui_agent_capabilities_help')}
                />
                {/* Code Execution */}
                {showCodeControls && <CodeForm agent_id={agent_id} files={code_files} />}
                {/* Web Search */}
                {webSearchEnabled && <SearchForm />}
                {/* File Context */}
                {contextEnabled && <FileContext agent_id={agent_id} files={context_files} />}
                {/* Artifacts */}
                {artifactsEnabled && <Artifacts />}
                {/* File Search */}
                {fileSearchEnabled && <FileSearch agent_id={agent_id} files={knowledge_files} />}
              </div>
            )}
            {/* MCP Section */}
            {showMCPControls && (
              <MCPTools
                agentId={agent_id}
                mcpServerNames={mcpServerNames}
                setShowMCPToolDialog={setShowMCPToolDialog}
              />
            )}
            {/* Support Contact (Optional) */}
            <div>
              <AgentFieldLabel
                label={localize('com_ui_support_contact')}
                description={localize('com_ui_agent_support_contact_help')}
              />
              <div className="space-y-3">
                {/* Support Contact Name */}
                <div className="flex flex-col">
                  <label
                    className="mb-1 flex items-center justify-between"
                    htmlFor="support-contact-name"
                  >
                    <span className="text-sm">{localize('com_ui_support_contact_name')}</span>
                  </label>
                  <Controller
                    name="support_contact.name"
                    control={control}
                    rules={{
                      minLength: {
                        value: 3,
                        message: localize('com_ui_support_contact_name_min_length', {
                          minLength: 3,
                        }),
                      },
                    }}
                    render={({ field, fieldState: { error } }) => (
                      <>
                        <input
                          {...field}
                          value={field.value ?? ''}
                          className={cn(inputClass, error ? 'border-2 border-red-500' : '')}
                          id="support-contact-name"
                          type="text"
                          placeholder={localize('com_ui_support_contact_name_placeholder')}
                          aria-label="Support contact name"
                          aria-invalid={error ? 'true' : 'false'}
                          aria-describedby={error ? 'support-contact-name-error' : undefined}
                        />
                        {error && (
                          <span
                            id="support-contact-name-error"
                            className="text-sm text-red-500 transition duration-300 ease-in-out"
                            role="alert"
                            aria-live="polite"
                          >
                            {error.message}
                          </span>
                        )}
                      </>
                    )}
                  />
                </div>
                {/* Support Contact Email */}
                <div className="flex flex-col">
                  <label
                    className="mb-1 flex items-center justify-between"
                    htmlFor="support-contact-email"
                  >
                    <span className="text-sm">{localize('com_ui_support_contact_email')}</span>
                  </label>
                  <Controller
                    name="support_contact.email"
                    control={control}
                    rules={{
                      validate: (value) =>
                        validateEmail(
                          value ?? '',
                          localize('com_ui_support_contact_email_invalid'),
                        ),
                    }}
                    render={({ field, fieldState: { error } }) => (
                      <>
                        <input
                          {...field}
                          value={field.value ?? ''}
                          className={cn(inputClass, error ? 'border-2 border-red-500' : '')}
                          id="support-contact-email"
                          type="email"
                          placeholder={localize('com_ui_support_contact_email_placeholder')}
                          aria-label="Support contact email"
                          aria-invalid={error ? 'true' : 'false'}
                          aria-describedby={error ? 'support-contact-email-error' : undefined}
                        />
                        {error && (
                          <span
                            id="support-contact-email-error"
                            className="text-sm text-red-500 transition duration-300 ease-in-out"
                            role="alert"
                            aria-live="polite"
                          >
                            {error.message}
                          </span>
                        )}
                      </>
                    )}
                  />
                </div>
              </div>
            </div>
          </div>
        </details>
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
