import { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { useFormContext } from 'react-hook-form';
import { useQueryClient } from '@tanstack/react-query';
import { OGDialog, OGDialogContent, OGDialogTitle } from '@librechat/client';
import { Constants, EModelEndpoint, QueryKeys } from 'librechat-data-provider';
import { useUpdateUserPluginsMutation } from 'librechat-data-provider/react-query';
import type { TError, AgentToolType } from 'librechat-data-provider';
import type { AgentForm, ToolDialogProps } from '~/common';
import {
  usePluginDialogHelpers,
  useMCPServerManager,
  useRemoveMCPTool,
  useLocalize,
} from '~/hooks';
import CustomUserVarsSection from '~/components/MCP/CustomUserVarsSection';
import { PluginPagination } from '~/components/Plugins/Store';
import { useAgentPanelContext } from '~/Providers';
import { useMCPToolsQuery } from '~/data-provider';
import MCPToolItem from './MCPToolItem';

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
  const searchInputRef = useRef<HTMLInputElement>(null);

  const {
    maxPage,
    setMaxPage,
    currentPage,
    setCurrentPage,
    itemsPerPage,
    searchChanged,
    setSearchChanged,
    searchValue,
    setSearchValue,
    gridRef,
    handleSearch,
    handleChangePage,
    error,
    setError,
    errorMessage,
    setErrorMessage,
  } = usePluginDialogHelpers();

  const updateUserPlugins = useUpdateUserPluginsMutation();

  const closeDialog = useCallback(() => {
    setIsOpen(false);
    setCurrentPage(1);
    setSearchValue('');
    setConfiguringServer(null);
    setIsInitializing(null);
  }, [setCurrentPage, setIsOpen, setSearchValue]);

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

  useEffect(() => {
    setMaxPage(Math.ceil(filteredServers.length / itemsPerPage));
    if (searchChanged) {
      setCurrentPage(1);
      setSearchChanged(false);
    }
  }, [
    setMaxPage,
    itemsPerPage,
    searchChanged,
    setCurrentPage,
    setSearchChanged,
    filteredServers.length,
  ]);

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
        overlayClassName="bg-surface-primary/60 dark:bg-surface-primary/80"
        className="max-h-[90vh] w-[min(calc(100%-2rem),72rem)] max-w-none gap-0 overflow-hidden rounded-lg bg-surface-secondary p-0 text-left shadow-xl max-sm:h-full"
        style={{ minHeight: '610px' }}
      >
        <div className="flex items-center justify-between border-b-[1px] border-border-medium px-4 pb-4 pt-5 sm:p-6">
          <div className="flex items-center">
            <div className="text-center sm:text-left">
              <OGDialogTitle
                id="mcp-tool-dialog-title"
                className="text-lg font-medium leading-6 text-text-primary"
              >
                {localize('com_nav_tool_dialog_mcp_server_tools')}
              </OGDialogTitle>
              <p id="mcp-tool-dialog-description" className="text-sm text-text-secondary">
                {localize('com_nav_tool_dialog_description')}
              </p>
            </div>
          </div>
          <div>
            <button
              onClick={closeDialog}
              className="inline-block rounded-full text-text-secondary transition-colors hover:text-text-primary"
              aria-label={localize('com_ui_close')}
              type="button"
            >
              <X aria-hidden="true" />
            </button>
          </div>
        </div>

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

        <div className="p-4 sm:p-6 sm:pt-4">
          <div className="mt-4 flex flex-col gap-4">
            <div className="mx-auto flex w-full max-w-xl items-center gap-3">
              <Search className="h-6 w-6 flex-none text-text-tertiary" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchValue}
                onChange={handleSearch}
                onMouseDown={(event) => event.stopPropagation()}
                onClick={(event) => event.stopPropagation()}
                onFocus={(event) => event.stopPropagation()}
                placeholder={localize('com_nav_tool_search')}
                className="h-10 min-w-0 flex-1 rounded border border-border-medium bg-transparent px-3 py-2 text-text-primary focus:outline-none"
              />
            </div>

            <div
              ref={gridRef}
              className="grid min-h-[22rem] grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            >
              {filteredServers
                .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                .map((serverInfo) => {
                  const isInstalled = installedToolsSet.has(serverInfo.serverName);
                  const isConfiguring = configuringServer === serverInfo.serverName;
                  const isServerInitializing = isInitializing === serverInfo.serverName;

                  const tool: AgentToolType = {
                    agent_id: agentId,
                    tool_id: serverInfo.serverName,
                    metadata: {
                      ...serverInfo.metadata,
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
            </div>
          </div>

          <div className="mt-2 flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
            {maxPage > 0 ? (
              <PluginPagination
                currentPage={currentPage}
                maxPage={maxPage}
                onChangePage={handleChangePage}
              />
            ) : (
              <div style={{ height: '21px' }}></div>
            )}
          </div>
        </div>
      </OGDialogContent>
    </OGDialog>
  );
}

export default MCPToolSelectDialog;
