import React, { useMemo } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import type { AgentForm } from '~/common';
import { useLocalize } from '~/hooks';
import { useAgentPanelContext } from '~/Providers';
import { isMCPToolSelected } from '~/components/Tools/agentToolSelection';
import { formatToolDisplayName } from '~/components/Tools/agentToolPresentation';

export default function MCPTools({
  setShowMCPToolDialog,
}: {
  setShowMCPToolDialog: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const localize = useLocalize();
  const { mcpServersMap } = useAgentPanelContext();
  const { control } = useFormContext<AgentForm>();
  const selectedToolIds = useWatch({ control, name: 'tools' }) ?? [];

  const selectedTools = useMemo(
    () =>
      Array.from(mcpServersMap.values()).flatMap((serverInfo) =>
        serverInfo.tools
          .filter((tool) => isMCPToolSelected(selectedToolIds, serverInfo.serverName, tool.tool_id))
          .map((tool) => ({
            id: tool.tool_id,
            name: formatToolDisplayName(String(tool.metadata.name || tool.tool_id)),
          })),
      ),
    [mcpServersMap, selectedToolIds],
  );

  return (
    <div className="agent-builder-mcp-tools">
      <div className="agent-builder-tools-label">
        <span>{localize('com_ui_tools')}</span>
        <span className="agent-builder-field-status agent-builder-field-status-optional">
          {localize('com_ui_agent_builder_optional_status')}
        </span>
        <p>{localize('com_ui_agent_tools_description')}</p>
      </div>
      <div
        className="agent-builder-mcp-tools-selected flex min-h-10 flex-wrap items-center gap-2 rounded-lg border border-border-light bg-surface-primary px-3 py-2"
        aria-live="polite"
      >
        {selectedTools.length > 0 ? (
          selectedTools.map((tool) => (
            <span
              className="rounded-full bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-700 dark:text-blue-300"
              key={tool.id}
            >
              {tool.name}
            </span>
          ))
        ) : (
          <span className="text-sm text-text-secondary">
            {localize('com_ui_agent_tool_picker_none_selected')}
          </span>
        )}
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
