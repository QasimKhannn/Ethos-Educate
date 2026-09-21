import { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import type { ChangeEvent } from 'react';
import { ArrowLeft, Search, X } from 'lucide-react';
import { useFormContext, useWatch } from 'react-hook-form';
import { useQueryClient } from '@tanstack/react-query';
import { OGDialog, OGDialogContent, OGDialogTitle } from '@librechat/client';
import { Constants, QueryKeys } from 'librechat-data-provider';
import { useUpdateUserPluginsMutation } from 'librechat-data-provider/react-query';
import type { TError } from 'librechat-data-provider';
import type { AgentForm, MCPServerInfo, ToolDialogProps } from '~/common';
import { useMCPServerManager, useLocalize } from '~/hooks';
import CustomUserVarsSection from '~/components/MCP/CustomUserVarsSection';
import { useAgentPanelContext } from '~/Providers';
import { useMCPToolsQuery } from '~/data-provider';
import AgentToolLibraryItem, { ToolProviderSetupCard } from './AgentToolLibraryItem';
import { addMCPToolToAgent, isMCPToolSelected, removeMCPToolFromAgent } from './agentToolSelection';

type PendingTool = {
  serverName: string;
  toolId: string;
};

type ToolCatalogItem = {
  description: string;
  id: string;
  icon: string;
  name: string;
  providerName: string;
  serverName: string;
};

const getProviderName = (serverInfo: MCPServerInfo): string =>
  String(serverInfo.metadata.name || serverInfo.serverName);

const matchesSearch = (searchValue: string, fields: Array<string | undefined>): boolean =>
  fields.some((field) => field?.toLowerCase().includes(searchValue));

function MCPToolSelectDialog({ isOpen, setIsOpen }: ToolDialogProps) {
  const localize = useLocalize();
  const queryClient = useQueryClient();
  const { initializeServer } = useMCPServerManager();
  const { control, getValues, setValue } = useFormContext<AgentForm>();
  const { mcpServersMap, availableMCPServersMap } = useAgentPanelContext();
  const { refetch: refetchMCPTools } = useMCPToolsQuery({ enabled: isOpen });
  const selectedToolIds = useWatch({ control, name: 'tools' }) ?? [];

  const [isSavingCustomVars, setIsSavingCustomVars] = useState(false);
  const [isPreparingServer, setIsPreparingServer] = useState<string | null>(null);
  const [configuringServer, setConfiguringServer] = useState<string | null>(null);
  const [pendingTool, setPendingTool] = useState<PendingTool | null>(null);
  const [searchValue, setSearchValue] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const updateUserPlugins = useUpdateUserPluginsMutation();

  const closeDialog = useCallback(() => {
    setIsOpen(false);
    setSearchValue('');
    setConfiguringServer(null);
    setPendingTool(null);
    setIsPreparingServer(null);
    setErrorMessage('');
  }, [setIsOpen]);

  const handleSearch = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchValue(event.target.value);
  };

  const handleInstallError = (error: TError) => {
    const message = error.response?.data?.message ?? '';
    setErrorMessage(message || localize('com_ui_mcp_init_failed'));
  };

  const prepareServer = useCallback(
    async (serverName: string, authData?: Record<string, string>): Promise<boolean> => {
      try {
        setIsPreparingServer(serverName);

        if (authData && Object.keys(authData).length > 0) {
          await updateUserPlugins.mutateAsync({
            pluginKey: `${Constants.mcp_prefix}${serverName}`,
            action: 'install',
            auth: authData,
            isEntityTool: true,
          });
          await queryClient.invalidateQueries([QueryKeys.mcpAuthValues, serverName]);
        }

        const result = await initializeServer(serverName);
        if (!result?.success || result.oauthRequired) {
          return false;
        }

        await refetchMCPTools();
        return true;
      } catch (error) {
        console.error('Error preparing tools:', error);
        handleInstallError(error as TError);
        return false;
      } finally {
        setIsPreparingServer(null);
      }
    },
    [initializeServer, queryClient, refetchMCPTools, updateUserPlugins],
  );

  const selectTool = useCallback(
    (serverName: string, toolId: string) => {
      setValue('tools', addMCPToolToAgent(getValues('tools') ?? [], serverName, toolId), {
        shouldDirty: true,
      });
    },
    [getValues, setValue],
  );

  const deselectTool = useCallback(
    (serverName: string, toolId: string, serverToolIds: string[]) => {
      setValue(
        'tools',
        removeMCPToolFromAgent(getValues('tools') ?? [], serverName, toolId, serverToolIds),
        { shouldDirty: true },
      );
    },
    [getValues, setValue],
  );

  const requiresSetup = useCallback(
    (serverName: string): boolean => {
      const customUserVars = availableMCPServersMap?.[serverName]?.customUserVars;
      return customUserVars != null && Object.keys(customUserVars).length > 0;
    },
    [availableMCPServersMap],
  );

  const handlePrepareProvider = async (serverName: string) => {
    setErrorMessage('');
    if (requiresSetup(serverName)) {
      setPendingTool(null);
      setConfiguringServer(serverName);
      return;
    }

    await prepareServer(serverName);
  };

  const handleToggleTool = async (serverInfo: MCPServerInfo, toolId: string) => {
    const serverName = serverInfo.serverName;
    const serverToolIds = serverInfo.tools.map((tool) => tool.tool_id);
    if (isMCPToolSelected(selectedToolIds, serverName, toolId)) {
      deselectTool(serverName, toolId, serverToolIds);
      return;
    }

    setErrorMessage('');
    if (requiresSetup(serverName)) {
      setPendingTool({ serverName, toolId });
      setConfiguringServer(serverName);
      return;
    }

    if (await prepareServer(serverName)) {
      selectTool(serverName, toolId);
    }
  };

  const handleSaveCustomVars = async (serverName: string, authData: Record<string, string>) => {
    const filteredAuthData = Object.fromEntries(
      Object.entries(authData).filter(([, value]) => value.trim().length > 0),
    );

    try {
      setIsSavingCustomVars(true);
      const wasPrepared = await prepareServer(
        serverName,
        Object.keys(filteredAuthData).length > 0 ? filteredAuthData : undefined,
      );

      if (wasPrepared && pendingTool?.serverName === serverName) {
        selectTool(serverName, pendingTool.toolId);
      }

      if (wasPrepared) {
        setConfiguringServer(null);
        setPendingTool(null);
      }
    } catch (error) {
      console.error('Error saving tool setup:', error);
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
        onError: (error) => {
          handleInstallError(error as TError);
          setIsSavingCustomVars(false);
        },
        onSuccess: () => {
          setConfiguringServer(null);
          setPendingTool(null);
          setIsSavingCustomVars(false);
        },
      },
    );
  };

  const mcpServers = useMemo(
    () =>
      Array.from(mcpServersMap.values())
        .filter((serverInfo) => !serverInfo.consumeOnly)
        .sort((a, b) => getProviderName(a).localeCompare(getProviderName(b))),
    [mcpServersMap],
  );

  const toolCatalog = useMemo<ToolCatalogItem[]>(
    () =>
      mcpServers.flatMap((serverInfo) => {
        const providerName = getProviderName(serverInfo);
        return serverInfo.tools.map((tool) => ({
          id: tool.tool_id,
          icon: String(tool.metadata.icon || ''),
          name: String(tool.metadata.name || tool.tool_id),
          description: String(tool.metadata.description || ''),
          providerName,
          serverName: serverInfo.serverName,
        }));
      }),
    [mcpServers],
  );

  const normalizedSearch = searchValue.trim().toLowerCase();
  const filteredToolCatalog = useMemo(
    () =>
      toolCatalog.filter(
        (tool) =>
          !normalizedSearch ||
          matchesSearch(normalizedSearch, [tool.name, tool.description, tool.providerName]),
      ),
    [normalizedSearch, toolCatalog],
  );

  const providersToPrepare = useMemo(
    () =>
      mcpServers.filter(
        (serverInfo) =>
          serverInfo.tools.length === 0 &&
          (!normalizedSearch ||
            matchesSearch(normalizedSearch, [
              getProviderName(serverInfo),
              String(serverInfo.metadata.description || ''),
            ])),
      ),
    [mcpServers, normalizedSearch],
  );

  const selectedToolCount = useMemo(
    () =>
      toolCatalog.filter((tool) => isMCPToolSelected(selectedToolIds, tool.serverName, tool.id))
        .length,
    [selectedToolIds, toolCatalog],
  );

  const configuringProviderName = useMemo(() => {
    const serverInfo = mcpServers.find((server) => server.serverName === configuringServer);
    return serverInfo ? getProviderName(serverInfo) : configuringServer;
  }, [configuringServer, mcpServers]);

  useEffect(() => {
    if (!isOpen || configuringServer) {
      return;
    }

    const frameId = requestAnimationFrame(() => searchInputRef.current?.focus());
    return () => cancelAnimationFrame(frameId);
  }, [configuringServer, isOpen]);

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
                {configuringServer
                  ? localize('com_ui_agent_tool_picker_setup_title', {
                      0: configuringProviderName ?? '',
                    })
                  : localize('com_ui_agent_tool_picker_title')}
              </OGDialogTitle>
              {!configuringServer ? (
                <span className="rounded-full bg-surface-tertiary px-2.5 py-1 text-xs font-medium text-text-secondary">
                  {localize('com_ui_agent_tool_picker_selected_count', { 0: selectedToolCount })}
                </span>
              ) : null}
            </div>
            <p
              id="mcp-tool-dialog-description"
              className="max-w-2xl text-sm leading-5 text-text-secondary"
            >
              {configuringServer
                ? localize('com_ui_agent_tool_picker_setup_description')
                : localize('com_ui_agent_tool_picker_description')}
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
          {errorMessage ? (
            <div
              className="m-4 rounded-lg border border-red-400 bg-red-100 px-4 py-3 text-sm text-red-700"
              role="alert"
            >
              {errorMessage}
            </div>
          ) : null}

          {configuringServer ? (
            <div className="p-5 sm:px-7 sm:py-6">
              <button
                className="btn btn-neutral border-token-border-light mb-5 h-9 gap-2"
                type="button"
                onClick={() => {
                  setConfiguringServer(null);
                  setPendingTool(null);
                }}
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                {localize('com_ui_agent_tool_picker_back')}
              </button>
              <CustomUserVarsSection
                serverName={configuringServer}
                isSubmitting={isSavingCustomVars}
                fields={availableMCPServersMap?.[configuringServer]?.customUserVars || {}}
                onSave={(authData) => handleSaveCustomVars(configuringServer, authData)}
                onRevoke={() => handleRevokeCustomVars(configuringServer)}
              />
            </div>
          ) : (
            <div className="p-5 sm:px-7 sm:py-6">
              <div className="flex flex-col gap-5">
                <div className="relative mx-auto w-full max-w-2xl">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-text-tertiary" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchValue}
                    onChange={handleSearch}
                    placeholder={localize('com_ui_agent_tool_picker_search')}
                    className="h-11 w-full rounded-lg border border-border-medium bg-surface-primary py-2 pl-10 pr-3 text-text-primary outline-none transition-colors placeholder:text-text-tertiary focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                  />
                </div>

                {filteredToolCatalog.length > 0 ? (
                  <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredToolCatalog.map((tool) => {
                      const serverInfo = mcpServersMap.get(tool.serverName);
                      if (!serverInfo) {
                        return null;
                      }

                      return (
                        <AgentToolLibraryItem
                          key={tool.id}
                          description={tool.description}
                          icon={tool.icon}
                          isPreparing={isPreparingServer === tool.serverName}
                          isSelected={isMCPToolSelected(selectedToolIds, tool.serverName, tool.id)}
                          name={tool.name}
                          onToggle={() => handleToggleTool(serverInfo, tool.id)}
                          providerName={tool.providerName}
                          toolId={tool.id}
                        />
                      );
                    })}
                  </div>
                ) : null}

                {providersToPrepare.length > 0 ? (
                  <section aria-label={localize('com_ui_agent_tool_picker_prepare_section')}>
                    <h3 className="mb-3 text-sm font-semibold text-text-primary">
                      {localize('com_ui_agent_tool_picker_prepare_section')}
                    </h3>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {providersToPrepare.map((serverInfo) => (
                        <ToolProviderSetupCard
                          key={serverInfo.serverName}
                          description={String(serverInfo.metadata.description || '')}
                          isPreparing={isPreparingServer === serverInfo.serverName}
                          name={getProviderName(serverInfo)}
                          onPrepare={() => handlePrepareProvider(serverInfo.serverName)}
                        />
                      ))}
                    </div>
                  </section>
                ) : null}

                {filteredToolCatalog.length === 0 && providersToPrepare.length === 0 ? (
                  <div className="flex min-h-[12rem] items-center justify-center rounded-xl border border-dashed border-border-medium bg-surface-primary px-6 text-center text-sm text-text-secondary">
                    {localize('com_ui_agent_tool_picker_empty')}
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </OGDialogContent>
    </OGDialog>
  );
}

export default MCPToolSelectDialog;
