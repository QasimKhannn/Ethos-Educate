import React, { memo, useMemo, useCallback, useRef } from 'react';
import * as Ariakit from '@ariakit/react';
import { ChevronDown } from 'lucide-react';
import { PermissionTypes, Permissions } from 'librechat-data-provider';
import { TooltipAnchor } from '@librechat/client';
import MCPServerMenuItem from '~/components/MCP/MCPServerMenuItem';
import MCPConfigDialog from '~/components/MCP/MCPConfigDialog';
import StackedMCPIcons from '~/components/MCP/StackedMCPIcons';
import { getMCPServerDisplayName } from '~/components/MCP/mcpServerUtils';
import { useBadgeRowContext } from '~/Providers';
import { useHasAccess } from '~/hooks';
import { cn } from '~/utils';

const normalizeServerName = (value: string): string => value.trim().toLowerCase();

const Excluded: ReadonlySet<string> = new Set(
  ['qa-mock', 'lesson-planning'].map(normalizeServerName),
);

function MCPSelectContent() {
  const { conversationId, storageContextKey, mcpServerManager } = useBadgeRowContext();
  const {
    localize,
    isPinned,
    mcpValues,
    placeholderText,
    selectableServers,
    connectionStatus,
    isInitializing,
    isCancellable,
    getConfigDialogProps,
    toggleServerSelection,
    getServerStatusIconProps,
  } = mcpServerManager;

  const visibleSelectableServers = useMemo(
    () =>
      selectableServers.filter((server) => !Excluded.has(normalizeServerName(server.serverName))),
    [selectableServers],
  );

  const menuStore = Ariakit.useMenuStore({ focusLoop: true });
  const isOpen = menuStore.useState('open');
  const focusedElementRef = useRef<HTMLElement | null>(null);

  const handleToggle = useCallback(
    (serverName: string) => {
      focusedElementRef.current = document.activeElement as HTMLElement;
      toggleServerSelection(serverName);
      requestAnimationFrame(() => {
        focusedElementRef.current?.focus();
      });
    },
    [toggleServerSelection],
  );

  const selectedServers = useMemo(() => {
    if (!mcpValues || mcpValues.length === 0) {
      return [];
    }
    return visibleSelectableServers.filter((server) => mcpValues.includes(server.serverName));
  }, [visibleSelectableServers, mcpValues]);

  const selectedCount = selectedServers.length;
  const hasInitializingServer = useMemo(
    () =>
      visibleSelectableServers.some(
        (server) => isInitializing(server.serverName) || isCancellable(server.serverName),
      ),
    [visibleSelectableServers, isInitializing, isCancellable],
  );

  const displayText = useMemo(() => {
    if (selectedCount === 0) {
      return null;
    }
    if (selectedCount === 1) {
      const server = selectedServers[0];
      return getMCPServerDisplayName(server.serverName, server.config?.title);
    }
    return localize('com_ui_x_selected', { 0: selectedCount });
  }, [selectedCount, selectedServers, localize]);

  if (!isPinned && selectedCount === 0 && !hasInitializingServer) {
    return null;
  }

  const configDialogProps = getConfigDialogProps();

  return (
    <>
      <Ariakit.MenuProvider store={menuStore}>
        <TooltipAnchor
          description={placeholderText}
          disabled={isOpen}
          render={
            <Ariakit.MenuButton
              className={cn(
                'group relative inline-flex items-center justify-center gap-1.5',
                'border border-border-medium text-sm font-medium transition-all',
                'h-9 min-w-9 rounded-full bg-transparent px-2.5 shadow-sm',
                'hover:bg-surface-hover hover:shadow-md active:shadow-inner',
                'md:w-fit md:justify-start md:px-3',
                isOpen && 'bg-surface-hover',
              )}
            />
          }
        >
          <StackedMCPIcons selectedServers={selectedServers} maxIcons={3} iconSize="sm" />
          <span className="hidden truncate text-text-primary md:block">
            {displayText || placeholderText}
          </span>
          <ChevronDown
            className={cn(
              'hidden h-3 w-3 text-text-secondary transition-transform md:block',
              isOpen && 'rotate-180',
            )}
          />
        </TooltipAnchor>

        <Ariakit.Menu
          portal={true}
          gutter={8}
          aria-label={localize('com_ui_mcp_servers')}
          className={cn(
            'z-50 flex min-w-[260px] max-w-[320px] flex-col rounded-xl',
            'border border-border-light bg-presentation p-1.5 shadow-lg',
            'origin-top opacity-0 transition-[opacity,transform] duration-200 ease-out',
            'data-[enter]:scale-100 data-[enter]:opacity-100',
            'scale-95 data-[leave]:scale-95 data-[leave]:opacity-0',
          )}
        >
          <div className="flex max-h-[320px] flex-col gap-1 overflow-y-auto">
            {visibleSelectableServers.map((server) => (
              <MCPServerMenuItem
                key={server.serverName}
                server={server}
                isSelected={mcpValues?.includes(server.serverName) ?? false}
                connectionStatus={connectionStatus}
                isInitializing={isInitializing}
                statusIconProps={getServerStatusIconProps(server.serverName)}
                onToggle={handleToggle}
              />
            ))}
          </div>
        </Ariakit.Menu>
      </Ariakit.MenuProvider>
      {configDialogProps && (
        <MCPConfigDialog
          {...configDialogProps}
          conversationId={conversationId}
          storageContextKey={storageContextKey}
        />
      )}
    </>
  );
}

function MCPSelect() {
  const { mcpServerManager } = useBadgeRowContext();
  const { selectableServers } = mcpServerManager;
  const canUseMcp = useHasAccess({
    permissionType: PermissionTypes.MCP_SERVERS,
    permission: Permissions.USE,
  });

  const hasVisibleServers = useMemo(
    () => selectableServers.some((server) => !Excluded.has(normalizeServerName(server.serverName))),
    [selectableServers],
  );

  if (!canUseMcp || !selectableServers || selectableServers.length === 0 || !hasVisibleServers) {
    return null;
  }

  return <MCPSelectContent />;
}

export default memo(MCPSelect);
