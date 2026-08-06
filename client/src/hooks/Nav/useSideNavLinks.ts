import { useMemo } from 'react';
import { Blocks, MCPIcon, AttachmentIcon } from '@librechat/client';
import {
  Database,
  Bookmark,
  ArrowLeftFromLine,
  ArrowRightToLine,
  MessageSquareQuote,
} from 'lucide-react';
import {
  Permissions,
  EModelEndpoint,
  PermissionTypes,
  SystemRoles,
  isAssistantsEndpoint,
} from 'librechat-data-provider';
import type { TEndpointsConfig } from 'librechat-data-provider';
import MCPBuilderPanel from '~/components/SidePanel/MCPBuilder/MCPBuilderPanel';
import type { NavLink } from '~/common';
import AgentPanelSwitch from '~/components/SidePanel/Agents/AgentPanelSwitch';
import BookmarkPanel from '~/components/SidePanel/Bookmarks/BookmarkPanel';
import PanelSwitch from '~/components/SidePanel/Builder/PanelSwitch';
import PromptsAccordion from '~/components/Prompts/PromptsAccordion';
import { MemoryPanel } from '~/components/SidePanel/Memories';
import FilesPanel from '~/components/SidePanel/Files/Panel';
import { useAuthContext, useHasAccess, useMCPServerManager } from '~/hooks';

export default function useSideNavLinks({
  hidePanel,
  collapsePanel,
  expandPanel,
  isCollapsed = false,
  isSmallScreen = false,
  keyProvided,
  endpoint,
  endpointsConfig,
}: {
  hidePanel?: () => void;
  collapsePanel?: () => void;
  expandPanel?: () => void;
  isCollapsed?: boolean;
  isSmallScreen?: boolean;
  keyProvided: boolean;
  endpoint?: EModelEndpoint | null;
  endpointsConfig: TEndpointsConfig;
}) {
  const { user } = useAuthContext();
  const isAdmin = user?.role === SystemRoles.ADMIN;
  const hasAccessToPrompts = useHasAccess({
    permissionType: PermissionTypes.PROMPTS,
    permission: Permissions.USE,
  });
  const hasAccessToBookmarks = useHasAccess({
    permissionType: PermissionTypes.BOOKMARKS,
    permission: Permissions.USE,
  });
  const hasAccessToMemories = useHasAccess({
    permissionType: PermissionTypes.MEMORIES,
    permission: Permissions.USE,
  });
  const hasAccessToReadMemories = useHasAccess({
    permissionType: PermissionTypes.MEMORIES,
    permission: Permissions.READ,
  });
  const hasAccessToAgents = useHasAccess({
    permissionType: PermissionTypes.AGENTS,
    permission: Permissions.USE,
  });
  const hasAccessToCreateAgents = useHasAccess({
    permissionType: PermissionTypes.AGENTS,
    permission: Permissions.CREATE,
  });
  const hasAccessToUseMCPSettings = useHasAccess({
    permissionType: PermissionTypes.MCP_SERVERS,
    permission: Permissions.USE,
  });
  const hasAccessToCreateMCP = useHasAccess({
    permissionType: PermissionTypes.MCP_SERVERS,
    permission: Permissions.CREATE,
  });
  const { availableMCPServers } = useMCPServerManager();

  const Links = useMemo(() => {
    const links: NavLink[] = [];
    const collapseHandler = collapsePanel ?? hidePanel;
    const expandHandler = expandPanel ?? (() => undefined);
    if (
      isAssistantsEndpoint(endpoint) &&
      ((endpoint === EModelEndpoint.assistants &&
        endpointsConfig?.[EModelEndpoint.assistants] &&
        endpointsConfig[EModelEndpoint.assistants].disableBuilder !== true) ||
        (endpoint === EModelEndpoint.azureAssistants &&
          endpointsConfig?.[EModelEndpoint.azureAssistants] &&
          endpointsConfig[EModelEndpoint.azureAssistants].disableBuilder !== true)) &&
      keyProvided
    ) {
      links.push({
        title: 'com_sidepanel_assistant_builder',
        description: 'com_ui_control_panel_tour_assistant_builder_body',
        label: '',
        icon: Blocks,
        id: EModelEndpoint.assistants,
        Component: PanelSwitch,
      });
    }

    if (
      endpointsConfig?.[EModelEndpoint.agents] &&
      hasAccessToAgents &&
      hasAccessToCreateAgents &&
      endpointsConfig[EModelEndpoint.agents].disableBuilder !== true
    ) {
      links.push({
        title: 'com_sidepanel_agent_builder',
        description: 'com_sidepanel_agent_help',
        label: '',
        icon: Blocks,
        id: EModelEndpoint.agents,
        Component: AgentPanelSwitch,
      });
    }

    if (hasAccessToPrompts) {
      links.push({
        title: 'com_ui_prompts',
        description: 'com_ui_control_panel_tour_prompts_body',
        label: '',
        icon: MessageSquareQuote,
        id: 'prompts',
        Component: PromptsAccordion,
      });
    }

    if (hasAccessToMemories && hasAccessToReadMemories) {
      links.push({
        title: 'com_ui_memories',
        description: 'com_ui_control_panel_tour_memories_body',
        label: '',
        icon: Database,
        id: 'memories',
        Component: MemoryPanel,
      });
    }

    links.push({
      title: 'com_sidepanel_attach_files',
      description: 'com_ui_control_panel_tour_files_body',
      label: '',
      icon: AttachmentIcon,
      id: 'files',
      Component: FilesPanel,
    });

    if (hasAccessToBookmarks) {
      links.push({
        title: 'com_sidepanel_conversation_tags',
        description: 'com_ui_control_panel_tour_bookmarks_body',
        label: '',
        icon: Bookmark,
        id: 'bookmarks',
        Component: BookmarkPanel,
      });
    }

    if (
      isAdmin &&
      ((hasAccessToUseMCPSettings && availableMCPServers && availableMCPServers.length > 0) ||
        hasAccessToCreateMCP)
    ) {
      links.push({
        title: 'com_nav_setting_mcp',
        description: 'com_ui_control_panel_tour_mcp_body',
        label: '',
        icon: MCPIcon,
        id: 'mcp-builder',
        Component: MCPBuilderPanel,
      });
    }

    if (!isSmallScreen && collapseHandler) {
      links.push({
        title: isCollapsed ? 'com_ui_expand' : 'com_ui_collapse',
        description: isCollapsed ? 'com_sidepanel_expand_help' : 'com_sidepanel_collapse_help',
        label: '',
        icon: isCollapsed ? ArrowLeftFromLine : ArrowRightToLine,
        onClick: isCollapsed ? expandHandler : collapseHandler,
        id: 'hide-panel',
      });
    }

    return links;
  }, [
    endpoint,
    endpointsConfig,
    keyProvided,
    hasAccessToAgents,
    hasAccessToCreateAgents,
    hasAccessToPrompts,
    hasAccessToMemories,
    hasAccessToReadMemories,
    hasAccessToBookmarks,
    availableMCPServers,
    hasAccessToUseMCPSettings,
    hasAccessToCreateMCP,
    isAdmin,
    isCollapsed,
    isSmallScreen,
    collapsePanel,
    expandPanel,
    hidePanel,
  ]);

  return Links;
}
