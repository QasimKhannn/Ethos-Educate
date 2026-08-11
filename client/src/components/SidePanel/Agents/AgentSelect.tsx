import { EarthIcon, SearchIcon, XIcon } from 'lucide-react';
import { ControlCombobox } from '@librechat/client';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import { AgentCapabilities, defaultAgentFormValues } from 'librechat-data-provider';
import type { UseMutationResult, QueryObserverResult } from '@tanstack/react-query';
import type { Agent, AgentCreateParams } from 'librechat-data-provider';
import type { TAgentCapabilities, AgentForm } from '~/common';
import { cn, createProviderOption, processAgentOption, getDefaultAgentFormValues } from '~/utils';
import { useLocalize, useAgentDefaultPermissionLevel } from '~/hooks';
import { useListAgentsQuery } from '~/data-provider';

const keys = new Set(Object.keys(defaultAgentFormValues));

function AgentSelect({
  agentQuery,
  selectedAgentId = null,
  setCurrentAgentId,
  createMutation,
}: {
  selectedAgentId: string | null;
  agentQuery: QueryObserverResult<Agent>;
  setCurrentAgentId: React.Dispatch<React.SetStateAction<string | undefined>>;
  createMutation: UseMutationResult<Agent, Error, AgentCreateParams>;
}) {
  const localize = useLocalize();
  const lastSelectedAgent = useRef<string | null>(null);
  const [agentSearch, setAgentSearch] = useState('');
  const { control, reset } = useFormContext();
  const permissionLevel = useAgentDefaultPermissionLevel();

  const { data: agents = null } = useListAgentsQuery(
    { requiredPermission: permissionLevel },
    {
      select: (res) =>
        res.data
          // cowork — the Cowork agent is managed inside the Cowork section; hide it from the
          // normal chat Agent Builder (it has no purpose to edit/select here).
          .filter((agent) => agent.id !== 'agent_cowork_default')
          .map((agent) =>
            processAgentOption({
              agent: {
                ...agent,
                name: agent.name || agent.id,
              },
            }),
          ),
    },
  );

  const filteredAgents = useMemo(() => {
    if (!agents) {
      return null;
    }

    const query = agentSearch.trim().toLocaleLowerCase();
    if (!query) {
      return agents;
    }

    return agents.filter((agent) => {
      const providerLabel =
        typeof agent.provider === 'object' && agent.provider != null
          ? agent.provider.label
          : agent.provider;
      const fields = [
        agent.name,
        agent.label,
        agent.id,
        agent.description,
        agent.category,
        providerLabel,
      ];

      return fields.some(
        (field) => typeof field === 'string' && field.toLocaleLowerCase().includes(query),
      );
    });
  }, [agentSearch, agents]);

  const resetAgentForm = useCallback(
    (fullAgent: Agent) => {
      const isGlobal = fullAgent.isPublic ?? false;
      const update = {
        ...fullAgent,
        provider: createProviderOption(fullAgent.provider),
        label: fullAgent.name ?? '',
        value: fullAgent.id || '',
        icon: isGlobal ? <EarthIcon className={'icon-lg text-green-400'} /> : null,
      };

      const capabilities: TAgentCapabilities = {
        [AgentCapabilities.web_search]: false,
        [AgentCapabilities.file_search]: false,
        [AgentCapabilities.execute_code]: false,
        [AgentCapabilities.end_after_tools]: false,
        [AgentCapabilities.hide_sequential_outputs]: false,
      };

      const agentTools: string[] = [];
      (fullAgent.tools ?? []).forEach((tool) => {
        if (capabilities[tool] !== undefined) {
          capabilities[tool] = true;
          return;
        }

        agentTools.push(tool);
      });

      const formValues: Partial<AgentForm & TAgentCapabilities> = {
        ...capabilities,
        agent: update,
        model: update.model,
        tools: agentTools,
        category: 'general',
        recommended_prompts: fullAgent.recommended_prompts ?? [],
        show_recommended_prompts: fullAgent.show_recommended_prompts !== false,
        // Make sure support_contact is properly loaded
        support_contact: fullAgent.support_contact,
        avatar_file: null,
        avatar_preview: fullAgent.avatar?.filepath ?? '',
        avatar_action: null,
      };

      Object.entries(fullAgent).forEach(([name, value]) => {
        if (name === 'model_parameters') {
          formValues[name] = value;
          return;
        }

        if (capabilities[name] !== undefined) {
          formValues[name] = value;
          return;
        }

        if (
          name === 'agent_ids' &&
          Array.isArray(value) &&
          value.every((item) => typeof item === 'string')
        ) {
          formValues[name] = value;
          return;
        }

        if (name === 'edges' && Array.isArray(value)) {
          formValues[name] = value;
          return;
        }

        if (name === 'tool_options' && typeof value === 'object' && value !== null) {
          formValues[name] = value;
          return;
        }

        if (name === 'recommended_prompts' && Array.isArray(value)) {
          formValues[name] = value;
          return;
        }

        if (name === 'category') {
          return;
        }

        if (!keys.has(name)) {
          return;
        }

        if (name === 'recursion_limit' && typeof value === 'number') {
          formValues[name] = value;
          return;
        }

        if (typeof value !== 'number' && typeof value !== 'object') {
          formValues[name] = value;
        }
      });

      reset(formValues);
    },
    [reset],
  );

  const onSelect = useCallback(
    (selectedId: string) => {
      const agentExists = !!(selectedId
        ? (agents ?? []).find((agent) => agent.id === selectedId)
        : undefined);

      createMutation.reset();
      if (!agentExists) {
        setCurrentAgentId(undefined);
        return reset(getDefaultAgentFormValues());
      }

      setCurrentAgentId(selectedId);
      const agent = agentQuery.data;
      if (!agent) {
        console.warn('Agent not found');
        return;
      }

      resetAgentForm(agent);
    },
    [agents, createMutation, setCurrentAgentId, agentQuery.data, resetAgentForm, reset],
  );

  useEffect(() => {
    if (agentQuery.data && agentQuery.isSuccess) {
      resetAgentForm(agentQuery.data);
    }
  }, [agentQuery.data, agentQuery.isSuccess, resetAgentForm]);

  useEffect(() => {
    let timerId: NodeJS.Timeout | null = null;

    if (selectedAgentId === lastSelectedAgent.current) {
      return;
    }

    if (selectedAgentId != null && selectedAgentId !== '' && agents) {
      timerId = setTimeout(() => {
        lastSelectedAgent.current = selectedAgentId;
        onSelect(selectedAgentId);
      }, 5);
    }

    return () => {
      if (timerId) {
        clearTimeout(timerId);
      }
    };
  }, [selectedAgentId, agents, onSelect]);

  const createAgent = localize('com_ui_create_new_agent');
  const hasAgentSearch = agentSearch.trim().length > 0;

  return (
    <Controller
      name="agent"
      control={control}
      render={({ field }) => (
        <div className="w-full space-y-2">
          <div className="relative">
            <SearchIcon
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary"
              aria-hidden="true"
            />
            <input
              type="search"
              value={agentSearch}
              onChange={(event) => setAgentSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                }
              }}
              placeholder={localize('com_agents_search_name')}
              aria-label={localize('com_agents_search_name')}
              className="h-10 w-full rounded-md border border-border-light bg-transparent py-2 pl-9 pr-9 text-sm text-text-primary outline-none transition-colors placeholder:text-text-secondary focus:border-blue-500"
            />
            {hasAgentSearch ? (
              <button
                type="button"
                onClick={() => setAgentSearch('')}
                className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
                aria-label={localize('com_agents_clear_search')}
              >
                <XIcon className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : null}
          </div>
          <ControlCombobox
            containerClassName="px-0"
            selectedValue={(field?.value?.value ?? '') + ''}
            displayValue={field?.value?.label ?? ''}
            selectPlaceholder={field?.value?.value ?? createAgent}
            iconSide="right"
            searchPlaceholder={localize('com_agents_search_name')}
            SelectIcon={field?.value?.icon}
            setValue={onSelect}
            items={
              filteredAgents?.map((agent) => ({
                label: agent.name ?? '',
                value: agent.id ?? '',
                icon: agent.icon,
              })) ?? [
                {
                  label: 'Loading...',
                  value: '',
                },
              ]
            }
            className={cn(
              'z-50 flex h-[40px] w-full flex-none items-center justify-center truncate rounded-md bg-transparent font-bold',
            )}
            ariaLabel={localize('com_ui_agent')}
            isCollapsed={false}
            showCarat={true}
          />
          {hasAgentSearch && filteredAgents?.length === 0 ? (
            <p className="px-1 text-xs text-text-secondary">
              {localize('com_agents_search_no_results', { query: agentSearch.trim() })}
            </p>
          ) : null}
        </div>
      )}
    />
  );
}

const MemoizedAgentSelect = memo(
  AgentSelect,
  (prevProps, nextProps) =>
    prevProps.selectedAgentId === nextProps.selectedAgentId &&
    prevProps.agentQuery.data === nextProps.agentQuery.data &&
    prevProps.agentQuery.isSuccess === nextProps.agentQuery.isSuccess &&
    prevProps.createMutation.data?.id === nextProps.createMutation.data?.id &&
    prevProps.createMutation.isLoading === nextProps.createMutation.isLoading,
);
MemoizedAgentSelect.displayName = 'AgentSelect';

export default MemoizedAgentSelect;
