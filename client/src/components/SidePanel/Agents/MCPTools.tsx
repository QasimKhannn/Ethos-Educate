import React from 'react';
import UninitializedMCPTool from './UninitializedMCPTool';
import UnconfiguredMCPTool from './UnconfiguredMCPTool';
import { useLocalize } from '~/hooks';
import { useAgentPanelContext } from '~/Providers';
import MCPTool from './MCPTool';

export default function MCPTools({
  agentId,
  mcpServerNames,
  setShowMCPToolDialog,
}: {
  agentId: string;
  mcpServerNames?: string[];
  setShowMCPToolDialog: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const localize = useLocalize();
  const { mcpServersMap } = useAgentPanelContext();

  return (
    <div className="agent-builder-mcp-tools">
      <div className="agent-builder-tools-label">
        <span>{localize('com_ui_tools')}</span>
        <span className="agent-builder-field-status agent-builder-field-status-optional">
          {localize('com_ui_agent_builder_optional_status')}
        </span>
        <p>{localize('com_ui_agent_tools_description')}</p>
      </div>
      <div className="agent-builder-mcp-tools-selected">
        {mcpServerNames?.map((mcpServerName) => {
          const serverInfo = mcpServersMap.get(mcpServerName);
          if (!serverInfo?.isConfigured) {
            return (
              <UnconfiguredMCPTool key={`${mcpServerName}-${agentId}`} serverName={mcpServerName} />
            );
          }
          if (!serverInfo) {
            return null;
          }

          if (serverInfo?.tools?.length && serverInfo.tools.length > 0) {
            return <MCPTool key={`${serverInfo.serverName}-${agentId}`} serverInfo={serverInfo} />;
          }

          return (
            <UninitializedMCPTool
              key={`${serverInfo.serverName}-${agentId}`}
              serverInfo={serverInfo}
            />
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => setShowMCPToolDialog(true)}
        className="btn btn-neutral agent-builder-mcp-tools-add border-token-border-light relative h-9 w-full rounded-lg font-medium"
        aria-haspopup="dialog"
      >
        <div className="flex w-full items-center justify-center gap-2">
          {localize('com_ui_agent_builder_add_tools')}
        </div>
      </button>
    </div>
  );
}
