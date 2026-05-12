import type { MCPServerStatus } from 'librechat-data-provider';
import type { MCPServerDefinition } from '~/hooks/MCP/useMCPServerManager';
import type { MCPServerStatusIconProps } from './MCPServerStatusIcon';
import { getKnownMCPServerDisplayName } from './knownMCPServers';

export type { MCPServerStatus };

export interface SelectedIconInfo {
  key: string;
  serverName: string;
  iconPath: string | null;
  displayName: string;
}

export type ConnectionStatusMap = Record<string, MCPServerStatus>;

export function getMCPServerDisplayName(serverName: string, title?: string | null): string {
  const trimmedTitle = title?.trim();
  if (trimmedTitle) {
    return trimmedTitle;
  }

  const mappedDisplayName = getKnownMCPServerDisplayName(serverName);
  if (mappedDisplayName) {
    return mappedDisplayName;
  }

  return serverName
    .trim()
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Generates a list of icons to display for selected MCP servers.
 * Each server keeps its own visual identity so known MCPs can show
 * dedicated fallback icons even when no custom iconPath is configured.
 */
export function getSelectedServerIcons(
  selectedServers: MCPServerDefinition[],
  maxIcons: number = 3,
): { icons: SelectedIconInfo[]; overflowCount: number } {
  const allIcons: SelectedIconInfo[] = selectedServers.map((server) => ({
    key: server.serverName,
    serverName: server.serverName,
    iconPath: server.config?.iconPath ?? null,
    displayName: getMCPServerDisplayName(server.serverName, server.config?.title),
  }));
  const visibleIcons = allIcons.slice(0, maxIcons);
  const overflowCount = Math.max(0, allIcons.length - maxIcons);

  return { icons: visibleIcons, overflowCount };
}

/**
 * Unified status color system following UX best practices:
 * - Green: Connected/Active (success)
 * - Blue: Connecting/In-progress (processing)
 * - Amber: Needs user action (OAuth required, config missing)
 * - Gray: Disconnected/Inactive (neutral - server is simply off)
 * - Red: Error (failed, needs retry)
 *
 * Key insight: "Disconnected" is neutral (gray), not a warning.
 * Amber is reserved for states requiring user intervention.
 */
export function getStatusColor(
  serverName: string,
  connectionStatus?: ConnectionStatusMap,
  isInitializing?: (serverName: string) => boolean,
): string {
  // In-progress states: blue
  if (isInitializing?.(serverName)) {
    return 'bg-blue-500';
  }

  const status = connectionStatus?.[serverName];
  if (!status) {
    return 'bg-gray-400';
  }

  const { connectionState, requiresOAuth } = status;

  // Connecting: blue (in progress)
  if (connectionState === 'connecting') {
    return 'bg-blue-500';
  }

  // Connected: green (success)
  if (connectionState === 'connected') {
    return 'bg-green-500';
  }

  // Error: red
  if (connectionState === 'error') {
    return 'bg-red-500';
  }

  // Disconnected: check if needs action or just inactive
  if (connectionState === 'disconnected') {
    // Needs OAuth = amber (requires user action)
    if (requiresOAuth) {
      return 'bg-amber-500';
    }
    // Simply disconnected = gray (neutral/inactive)
    return 'bg-gray-400';
  }

  return 'bg-gray-400';
}

export function getStatusTextKey(
  serverName: string,
  connectionStatus?: ConnectionStatusMap,
  isInitializing?: (serverName: string) => boolean,
): string {
  if (isInitializing?.(serverName)) {
    return 'com_nav_mcp_status_initializing';
  }

  const status = connectionStatus?.[serverName];
  if (!status) {
    return 'com_nav_mcp_status_unknown';
  }

  const { connectionState, requiresOAuth } = status;

  // Special case: disconnected but needs OAuth shows different text
  if (connectionState === 'disconnected' && requiresOAuth) {
    return 'com_nav_mcp_status_needs_auth';
  }

  const keyMap: Record<string, string> = {
    connected: 'com_nav_mcp_status_connected',
    connecting: 'com_nav_mcp_status_connecting',
    disconnected: 'com_nav_mcp_status_disconnected',
    error: 'com_nav_mcp_status_error',
  };

  return keyMap[connectionState] || 'com_nav_mcp_status_unknown';
}

/**
 * Determines if a server requires user action to connect.
 * Used to show action buttons and amber status color.
 */
export function serverNeedsAction(
  serverStatus?: MCPServerStatus,
  _hasCustomUserVars?: boolean,
): boolean {
  if (!serverStatus) return false;
  const { connectionState, requiresOAuth } = serverStatus;

  // Needs OAuth authentication
  if (connectionState === 'disconnected' && requiresOAuth) return true;

  // Has error - needs retry
  if (connectionState === 'error') return true;

  return false;
}

/**
 * Determines if an action button should be shown for a server status.
 * Returns true only when the button would be actionable (not just informational).
 */
export function shouldShowActionButton(statusIconProps?: MCPServerStatusIconProps | null): boolean {
  if (!statusIconProps) return false;

  const { serverStatus, canCancel, hasCustomUserVars, isInitializing } = statusIconProps;

  // Show a cancellable loading control during OAuth/init flows
  if (isInitializing) return canCancel;

  if (!serverStatus) return false;
  const { connectionState, requiresOAuth } = serverStatus;

  // Show for disconnected/error (can reconnect/configure)
  if (connectionState === 'disconnected' || connectionState === 'error') return true;
  // Show cancellable spinner during OAuth-related connecting states
  if (connectionState === 'connecting') return canCancel;
  // Connected: only show if there's config to manage
  if (connectionState === 'connected') return hasCustomUserVars || requiresOAuth;

  return false;
}
