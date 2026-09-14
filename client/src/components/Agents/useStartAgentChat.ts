import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { getAgentIntakeTemplate } from './agentIntake';
import { createAgentIntakeLaunch } from './agentIntakeLaunch';

const selectedToolGuideKey = 'eduToolkitSelectedToolGuide';

export default function useStartAgentChat() {
  const localize = useLocalize();
  const queryClient = useQueryClient();
  const getDefaultConversation = useDefaultConvo();
  const { conversation, newConversation } = useChatContext();
  const navigate = useNavigate();

  return useCallback(
    (agent: t.Agent | null | undefined, initialPrompt?: string) => {
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
        spec: null,
        ...(agentAvatarUrl != null ? { iconURL: agentAvatarUrl } : {}),
        title: localize('com_agents_chat_with', {
          name: agentDisplayName || localize('com_ui_agent'),
        }),
      };

      const currentConvo = getDefaultConversation({
        conversation: { ...(conversation ?? {}), ...template },
        preset: template,
      });

      if (initialPrompt?.trim()) {
        newConversation({
          template: currentConvo,
          preset: template,
        });

        const intakeTemplate = getAgentIntakeTemplate(agent);
        const intakeLaunch = intakeTemplate
          ? createAgentIntakeLaunch({
              agentId: agent.id,
              template: intakeTemplate,
              prompt: initialPrompt.trim(),
            })
          : null;

        if (intakeLaunch) {
          const params = new URLSearchParams({
            agent_id: agent.id,
            intake: intakeLaunch.id,
          });
          navigate(`/c/new?${params.toString()}`);
          return;
        }

        const params = new URLSearchParams({
          agent_id: agent.id,
          prompt: initialPrompt.trim(),
          submit: 'true',
        });
        navigate(`/c/new?${params.toString()}`);
        return;
      }

      newConversation({
        template: currentConvo,
        preset: template,
      });
    },
    [conversation, getDefaultConversation, localize, navigate, newConversation, queryClient],
  );
}
