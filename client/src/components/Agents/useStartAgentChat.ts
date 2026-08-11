import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Constants,
  QueryKeys,
  EModelEndpoint,
  PermissionBits,
  LocalStorageKeys,
} from 'librechat-data-provider';
import type t from 'librechat-data-provider';
import type { AgentListResponse } from 'librechat-data-provider';
import { clearMessagesCache, getAgentAvatarImageUrl, getAgentDisplayName } from '~/utils';
import { useDefaultConvo, useLocalize } from '~/hooks';
import { useChatContext } from '~/Providers';

const selectedToolGuideKey = 'eduToolkitSelectedToolGuide';

export default function useStartAgentChat() {
  const localize = useLocalize();
  const queryClient = useQueryClient();
  const getDefaultConversation = useDefaultConvo();
  const { conversation, newConversation } = useChatContext();

  return useCallback(
    (agent: t.Agent | null | undefined) => {
      if (agent == null) {
        return;
      }

      const agentAvatarUrl = getAgentAvatarImageUrl(agent);
      const agentDisplayName = getAgentDisplayName(agent);
      const keys = [QueryKeys.agents, { requiredPermission: PermissionBits.EDIT }];
      const listResp = queryClient.getQueryData<AgentListResponse>(keys);

      if (listResp != null && !listResp.data.some((candidate) => candidate.id === agent.id)) {
        queryClient.setQueryData<AgentListResponse>(keys, {
          ...listResp,
          data: [agent, ...listResp.data],
        });
      }

      localStorage.setItem(`${LocalStorageKeys.AGENT_ID_PREFIX}0`, agent.id);
      localStorage.setItem(
        selectedToolGuideKey,
        JSON.stringify({
          agentId: agent.id,
          name: agentDisplayName,
          description: agent.description,
          avatarUrl: agentAvatarUrl,
        }),
      );

      clearMessagesCache(queryClient, conversation?.conversationId);
      queryClient.invalidateQueries([QueryKeys.messages]);

      const template = {
        conversationId: Constants.NEW_CONVO as string,
        endpoint: EModelEndpoint.agents,
        agent_id: agent.id,
        ...(agentAvatarUrl != null ? { iconURL: agentAvatarUrl } : {}),
        title: localize('com_agents_chat_with', {
          name: agentDisplayName || localize('com_ui_agent'),
        }),
      };

      const currentConvo = getDefaultConversation({
        conversation: { ...(conversation ?? {}), ...template },
        preset: template,
      });

      newConversation({
        template: currentConvo,
        preset: template,
      });
    },
    [conversation, getDefaultConversation, localize, newConversation, queryClient],
  );
}
