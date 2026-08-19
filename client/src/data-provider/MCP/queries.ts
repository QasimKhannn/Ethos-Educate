import { useQuery, UseQueryOptions, QueryObserverResult } from '@tanstack/react-query';
import { QueryKeys, dataService } from 'librechat-data-provider';
import type * as t from 'librechat-data-provider';

interface MCPServersQueryOptions {
  agentBuilderAccess?: boolean;
}

/**
 * Hook for fetching all accessible MCP servers with permission metadata
 */
export const useMCPServersQuery = <TData = t.MCPServersListResponse>(
  config?: UseQueryOptions<t.MCPServersListResponse, unknown, TData>,
  options?: MCPServersQueryOptions,
): QueryObserverResult<TData> => {
  return useQuery<t.MCPServersListResponse, unknown, TData>(
    [QueryKeys.mcpServers, options?.agentBuilderAccess === true ? 'agent-builder' : 'default'],
    () => dataService.getMCPServers(options),
    {
      staleTime: 30 * 1000, // 30 seconds — short enough to pick up servers that finish initializing after first load
      refetchOnWindowFocus: true,
      refetchOnReconnect: false,
      refetchOnMount: true,
      retry: false,
      ...config,
    },
  );
};

/**
 * Hook for fetching MCP-specific tools
 * @param config - React Query configuration
 * @returns MCP servers with their tools
 */
export const useMCPToolsQuery = <TData = t.MCPServersResponse>(
  config?: UseQueryOptions<t.MCPServersResponse, unknown, TData>,
): QueryObserverResult<TData> => {
  return useQuery<t.MCPServersResponse, unknown, TData>(
    [QueryKeys.mcpTools],
    () => dataService.getMCPTools(),
    {
      // Tool manifests are cached by the server. Always retrieve the current manifest when this
      // UI is opened or revisited so a shared MCP refresh is visible to every signed-in user.
      refetchOnWindowFocus: 'always',
      refetchOnReconnect: 'always',
      refetchOnMount: 'always',
      staleTime: 0,
      ...config,
    },
  );
};
