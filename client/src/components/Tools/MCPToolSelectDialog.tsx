import { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import type { ChangeEvent } from 'react';
import { Search, X } from 'lucide-react';
import { useFormContext } from 'react-hook-form';
import { useQueryClient } from '@tanstack/react-query';
import { OGDialog, OGDialogContent, OGDialogTitle } from '@librechat/client';
import { Constants, EModelEndpoint, QueryKeys } from 'librechat-data-provider';
import { useUpdateUserPluginsMutation } from 'librechat-data-provider/react-query';
import type { TError, AgentToolType } from 'librechat-data-provider';
import type { AgentForm, ToolDialogProps } from '~/common';
import { useMCPServerManager, useRemoveMCPTool, useLocalize } from '~/hooks';
import CustomUserVarsSection from '~/components/MCP/CustomUserVarsSection';
import { useAgentPanelContext } from '~/Providers';
import { useMCPToolsQuery } from '~/data-provider';
import MCPToolItem from './MCPToolItem';

const toolNameOverrides: Readonly<Record<string, string>> = {
  airtable: 'Airtable',
  github: 'GitHub',
  mailchimp: 'Mailchimp',
  onedrive: 'OneDrive',
  outlook: 'Outlook',
  sharepoint: 'SharePoint',
  websearch: 'Web search',
};

const formatToolName = (name: string): string => {
  const formattedName = name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const lowercaseName = formattedName.toLowerCase();

  if (toolNameOverrides[lowercaseName]) {
    return toolNameOverrides[lowercaseName];
  }

  return formattedName
    .split(' ')
    .map((word) =>
      word === word.toLowerCase() ? `${word[0].toUpperCase()}${word.slice(1)}` : word,
    )
    .join(' ');
};

function MCPToolSelectDialog({
  isOpen,
  agentId,
  setIsOpen,
  mcpServerNames,
}: ToolDialogProps & {
  agentId: string;
  mcpServerNames?: string[];
  endpoint: EModelEndpoint.agents;
}) {
  const localize = useLocalize();
  const queryClient = useQueryClient();
  const { initializeServer } = useMCPServerManager();
  const { getValues, setValue } = useFormContext<AgentForm>();
  const { removeTool } = useRemoveMCPTool({ showToast: false });
  const { mcpServersMap, availableMCPServersMap } = useAgentPanelContext();
  const { refetch: refetchMCPTools } = useMCPToolsQuery({
    enabled: mcpServersMap.size > 0,
  });

  const [isSavingCustomVars, setIsSavingCustomVars] = useState(false);
  const [isInitializing, setIsInitializing] = useState<string | null>(null);
  const [configuringServer, setConfiguringServer] = useState<string | null>(null);
  const [searchValue, setSearchValue] = useState('');
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const updateUserPlugins = useUpdateUserPluginsMutation();

  const closeDialog = useCallback(() => {
    setIsOpen(false);
    setSearchValue('');
    setConfiguringServer(null);
    setIsInitializing(null);
  }, [setIsOpen]);

  const handleSearch = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchValue(event.target.value);
  };

  const handleInstallError = (error: TError) => {
    setError(true);
    const errorMessage = error.response?.data?.message ?? '';
    if (errorMessage) {
      setErrorMessage(errorMessage);
    }
    setTimeout(() => {
      setError(false);
      setErrorMessage('');
    }, 5000);
  };

  const handleDirectAdd = async (serverName: string, authData?: Record<string, string>) => {
    try {
      setIsInitializing(serverName);

      // First, save auth if provided
      if (authData && Object.keys(authData).length > 0) {
        await updateUserPlugins.mutateAsync({
          pluginKey: `${Constants.mcp_prefix}${serverName}`,
          action: 'install',
          auth: authData,
          isEntityTool: true,
        });

        // Invalidate auth values query to ensure fresh data
        await queryClient.invalidateQueries([QueryKeys.mcpAuthValues, serverName]);

        // Small delay to ensure backend has processed the auth
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      // Refresh the tool manifest so a re-added MCP uses its current server tools.
      const result = await initializeServer(serverName);
      if (result?.oauthRequired && result.oauthUrl) {
        setIsInitializing(null);
        return; // OAuth flow must complete first
      }

      // Add tools to form from the refreshed backend cache.
      await addToolsToForm(serverName);
      setIsInitializing(null);
    } catch (error) {
      console.error('Error adding MCP server:', error);
      handleInstallError(error as TError);
      setIsInitializing(null);
    }
  };

  const addToolsToForm = async (serverName: string) => {
    const { data: updatedMCPData } = await refetchMCPTools();

    const currentTools = getValues('tools') || [];
    const toolsToAdd: string[] = [`${Constants.mcp_server}${Constants.mcp_delimiter}${serverName}`];

    if (updatedMCPData?.servers?.[serverName]) {
      const serverData = updatedMCPData.servers[serverName];
      serverData.tools.forEach((tool) => {
        toolsToAdd.push(tool.pluginKey);
      });
    }

    const newTools = toolsToAdd.filter((tool) => !currentTools.includes(tool));
    if (newTools.length > 0) {
      setValue('tools', [...currentTools, ...newTools]);
    }
  };

  const handleSaveCustomVars = async (serverName: string, authData: Record<string, string>) => {
    try {
      setIsSavingCustomVars(true);

      // Filter out empty values to avoid overwriting existing values with empty ones
      const filteredAuthData: Record<string, string> = {};
      Object.entries(authData).forEach(([key, value]) => {
        if (value && value.trim()) {
          filteredAuthData[key] = value.trim();
        }
      });

      // Always add the tool, but only pass auth data if there are values to save
      // Empty auth data is fine - the tool can work without credentials
      await handleDirectAdd(
        serverName,
        Object.keys(filteredAuthData).length > 0 ? filteredAuthData : undefined,
      );
      setConfiguringServer(null);
    } catch (error) {
      console.error('Error saving custom vars:', error);
      handleInstallError(error as TError);
    } finally {
      setIsSavingCustomVars(false);
    }
  };

  const handleRevokeCustomVars = (serverName: string) => {
    setIsSavingCustomVars(true);
    updateUserPlugins.mutate(
      {
        pluginKey: `${Constants.mcp_prefix}${serverName}`,
        action: 'uninstall',
        auth: {},
        isEntityTool: true,
      },
      {
        onError: (error: unknown) => {
          handleInstallError(error as TError);
          setIsSavingCustomVars(false);
        },
        onSuccess: async () => {
          setConfiguringServer(null);
          setIsSavingCustomVars(false);
        },
      },
    );
  };

  const onAddTool = async (serverName: string) => {
    if (configuringServer === serverName) {
      setConfiguringServer(null);
      await handleDirectAdd(serverName);
      return;
    }

    const serverConfig = availableMCPServersMap?.[serverName];
    const hasCustomUserVars =
      serverConfig?.customUserVars && Object.keys(serverConfig.customUserVars).length > 0;

    if (hasCustomUserVars) {
      setConfiguringServer(serverName);
    } else {
      await handleDirectAdd(serverName);
    }
  };

  const installedToolsSet = useMemo(() => {
    return new Set(mcpServerNames);
  }, [mcpServerNames]);

  const selectedToolCount = installedToolsSet.size;

  const mcpServers = useMemo(() => {
    const servers = Array.from(mcpServersMap.values()).filter((s) => !s.consumeOnly);
    return servers.sort((a, b) => a.serverName.localeCompare(b.serverName));
  }, [mcpServersMap]);

  const filteredServers = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase();
    if (!normalizedSearch) {
      return mcpServers;
    }
    return mcpServers.filter((serverInfo) => {
      const serverConfig = availableMCPServersMap?.[serverInfo.serverName];
      const searchableFields = [
        serverInfo.serverName,
        serverInfo.metadata.name,
        serverInfo.metadata.description,
        serverConfig?.title,
        serverConfig?.description,
      ];

      return searchableFields.some(
        (field) => typeof field === 'string' && field.toLowerCase().includes(normalizedSearch),
      );
    });
  }, [availableMCPServersMap, mcpServers, searchValue]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const frameId = requestAnimationFrame(() => searchInputRef.current?.focus());
    return () => cancelAnimationFrame(frameId);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeDialog();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [closeDialog, isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <OGDialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          closeDialog();
        }
      }}
      modal
    >
      <OGDialogContent
        aria-describedby="mcp-tool-dialog-description"
        showCloseButton={false}
        overlayClassName="bg-black/55 backdrop-blur-[1px]"
        className="flex h-[min(82vh,48rem)] max-h-[90vh] w-[min(calc(100%-2rem),70rem)] max-w-none flex-col gap-0 overflow-hidden rounded-xl border border-border-heavy bg-surface-secondary p-0 text-left shadow-2xl ring-1 ring-black/10 max-sm:h-full"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border-medium px-5 py-5 sm:px-7">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <OGDialogTitle
                id="mcp-tool-dialog-title"
                className="text-xl font-semibold leading-6 text-text-primary"
              >
                {localize('com_ui_agent_tool_picker_title')}
              </OGDialogTitle>
              <span className="rounded-full bg-surface-tertiary px-2.5 py-1 text-xs font-medium text-text-secondary">
                {localize('com_ui_agent_tool_picker_selected_count', { 0: selectedToolCount })}
              </span>
            </div>
            <p
              id="mcp-tool-dialog-description"
              className="max-w-2xl text-sm leading-5 text-text-secondary"
            >
              {localize('com_ui_agent_tool_picker_description')}
            </p>
          </div>
          <button
            onClick={closeDialog}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-surface-tertiary hover:text-text-primary"
            aria-label={localize('com_ui_close')}
            type="button"
          >
            <X aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {error && (
            <div
              className="relative m-4 rounded border border-red-400 bg-red-100 px-4 py-3 text-red-700"
              role="alert"
            >
              {localize('com_nav_plugin_auth_error')} {errorMessage}
            </div>
          )}

          {configuringServer && (
            <div className="p-4 sm:p-6 sm:pt-4">
              <div className="mb-4">
                <p className="text-sm text-text-secondary">
                  {localize('com_ui_mcp_configure_server_description', { 0: configuringServer })}
                </p>
              </div>
              <CustomUserVarsSection
                serverName={configuringServer}
                isSubmitting={isSavingCustomVars}
                fields={availableMCPServersMap?.[configuringServer]?.customUserVars || {}}
                onSave={(authData) => handleSaveCustomVars(configuringServer, authData)}
                onRevoke={() => handleRevokeCustomVars(configuringServer)}
              />
            </div>
          )}

          <div className="p-5 sm:px-7 sm:py-6">
            <div className="flex flex-col gap-5">
              <div className="relative mx-auto w-full max-w-2xl">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-text-tertiary" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchValue}
                  onChange={handleSearch}
                  onMouseDown={(event) => event.stopPropagation()}
                  onClick={(event) => event.stopPropagation()}
                  onFocus={(event) => event.stopPropagation()}
                  placeholder={localize('com_ui_agent_tool_picker_search')}
                  className="h-11 w-full rounded-lg border border-border-medium bg-surface-primary py-2 pl-10 pr-3 text-text-primary outline-none transition-colors placeholder:text-text-tertiary focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                />
              </div>

              <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredServers.map((serverInfo) => {
                  const isInstalled = installedToolsSet.has(serverInfo.serverName);
                  const isConfiguring = configuringServer === serverInfo.serverName;
                  const isServerInitializing = isInitializing === serverInfo.serverName;
                  const serverConfig = availableMCPServersMap?.[serverInfo.serverName];
                  const toolName = formatToolName(
                    serverConfig?.title || serverInfo.metadata.name || serverInfo.serverName,
                  );
                  const toolDescription =
                    serverConfig?.description || serverInfo.metadata.description || '';

                  const tool: AgentToolType = {
                    agent_id: agentId,
                    tool_id: serverInfo.serverName,
                    metadata: {
                      ...serverInfo.metadata,
                      name: toolName,
                      description: toolDescription,
                    },
                  };

                  return (
                    <MCPToolItem
                      tool={tool}
                      isInstalled={isInstalled}
                      key={serverInfo.serverName}
                      isConfiguring={isConfiguring}
                      isInitializing={isServerInitializing}
                      onAddTool={() => onAddTool(serverInfo.serverName)}
                      onRemoveTool={() => removeTool(serverInfo.serverName)}
                    />
                  );
                })}
                {filteredServers.length === 0 ? (
                  <div className="col-span-full flex min-h-[12rem] items-center justify-center rounded-xl border border-dashed border-border-medium bg-surface-primary px-6 text-center text-sm text-text-secondary">
                    {localize('com_ui_agent_tool_picker_empty')}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </OGDialogContent>
    </OGDialog>
  );
}

export default MCPToolSelectDialog;
