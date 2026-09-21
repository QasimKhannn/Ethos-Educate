import { Constants } from 'librechat-data-provider';

const uniqueToolIds = (toolIds: string[]): string[] => Array.from(new Set(toolIds));

export const getMCPServerName = (toolId: string): string | undefined => {
  const delimiterIndex = toolId.lastIndexOf(Constants.mcp_delimiter);
  if (delimiterIndex < 0) {
    return undefined;
  }

  const serverName = toolId.slice(delimiterIndex + Constants.mcp_delimiter.length);
  return serverName || undefined;
};

export const getMCPServerMarker = (serverName: string): string =>
  `${Constants.mcp_server}${Constants.mcp_delimiter}${serverName}`;

const getMCPAllMarker = (serverName: string): string =>
  `${Constants.mcp_all}${Constants.mcp_delimiter}${serverName}`;

const belongsToServer = (toolId: string, serverName: string): boolean =>
  getMCPServerName(toolId) === serverName;

const isServerMarker = (toolId: string, serverName: string): boolean =>
  toolId === getMCPServerMarker(serverName) || toolId === getMCPAllMarker(serverName);

export const isMCPToolSelected = (toolIds: string[], serverName: string, toolId: string): boolean =>
  toolIds.includes(toolId) || toolIds.includes(getMCPAllMarker(serverName));

export const addMCPToolToAgent = (
  toolIds: string[],
  serverName: string,
  toolId: string,
): string[] => {
  if (isMCPToolSelected(toolIds, serverName, toolId)) {
    return toolIds;
  }

  return uniqueToolIds([...toolIds, getMCPServerMarker(serverName), toolId]);
};

export const removeMCPToolFromAgent = (
  toolIds: string[],
  serverName: string,
  toolId: string,
  serverToolIds: string[],
): string[] => {
  const allToolsMarker = getMCPAllMarker(serverName);
  if (toolIds.includes(allToolsMarker)) {
    const nonServerTools = toolIds.filter((id) => !belongsToServer(id, serverName));
    const remainingServerToolIds = serverToolIds.filter((id) => id !== toolId);

    if (remainingServerToolIds.length === 0) {
      return nonServerTools;
    }

    return uniqueToolIds([
      ...nonServerTools,
      getMCPServerMarker(serverName),
      ...remainingServerToolIds,
    ]);
  }

  const withoutTool = toolIds.filter((id) => id !== toolId);
  const hasSelectedTool = withoutTool.some(
    (id) => belongsToServer(id, serverName) && !isServerMarker(id, serverName),
  );

  if (hasSelectedTool) {
    return withoutTool;
  }

  return withoutTool.filter((id) => id !== getMCPServerMarker(serverName));
};
