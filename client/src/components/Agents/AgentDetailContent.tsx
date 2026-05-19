import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, Pin, PinOff } from 'lucide-react';
import { OGDialogContent, Button, useToastContext } from '@librechat/client';
import {
  QueryKeys,
  Constants,
  EModelEndpoint,
  PermissionBits,
  LocalStorageKeys,
  AgentListResponse,
} from 'librechat-data-provider';
import type t from 'librechat-data-provider';
import { useLocalize, useFavorites, useDefaultConvo } from '~/hooks';
import { useChatContext } from '~/Providers';
import { renderAgentAvatar, clearMessagesCache, getAgentAvatarUrl } from '~/utils';

interface SupportContact {
  name?: string;
  email?: string;
}

interface AgentWithSupport extends t.Agent {
  support_contact?: SupportContact;
}

interface AgentDetailContentProps {
  agent: AgentWithSupport;
}

/**
 * Dialog content for displaying agent details
 * Used inside OGDialog with OGDialogTrigger for proper focus management
 */
const AgentDetailContent: React.FC<AgentDetailContentProps> = ({ agent }) => {
  const localize = useLocalize();
  const byLabel = localize('com_ui_by_author', { 0: '' }).trim();
  const { showToast } = useToastContext();
  const queryClient = useQueryClient();
  const getDefaultConversation = useDefaultConvo();
  const { conversation, newConversation } = useChatContext();
  const { isFavoriteAgent, toggleFavoriteAgent } = useFavorites();
  const isFavorite = isFavoriteAgent(agent?.id);

  const handleFavoriteClick = () => {
    if (agent) {
      toggleFavoriteAgent(agent.id);
    }
  };

  const handleStartChat = () => {
    if (agent) {
      const agentAvatarUrl = getAgentAvatarUrl(agent);
      const keys = [QueryKeys.agents, { requiredPermission: PermissionBits.EDIT }];
      const listResp = queryClient.getQueryData<AgentListResponse>(keys);

      if (listResp != null && !listResp.data.some((candidate) => candidate.id === agent.id)) {
        const currentAgents = [agent, ...JSON.parse(JSON.stringify(listResp.data))];
        queryClient.setQueryData<AgentListResponse>(keys, { ...listResp, data: currentAgents });
      }

      localStorage.setItem(`${LocalStorageKeys.AGENT_ID_PREFIX}0`, agent.id);
      localStorage.setItem(
        'eduToolkitSelectedToolGuide',
        JSON.stringify({
          agentId: agent.id,
          name: agent.name,
          category: agent.category,
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
          name: agent.name || localize('com_ui_agent'),
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
    }
  };

  /**
   * Copy the agent's shareable link to clipboard
   */
  const handleCopyLink = () => {
    const baseUrl = new URL(window.location.origin);
    const chatUrl = `${baseUrl.origin}/c/new?agent_id=${agent.id}`;
    navigator.clipboard
      .writeText(chatUrl)
      .then(() => {
        showToast({
          message: localize('com_agents_link_copied'),
        });
      })
      .catch(() => {
        showToast({
          message: localize('com_agents_link_copy_failed'),
        });
      });
  };

  /**
   * Format contact information with mailto links when appropriate
   */
  const formatContact = () => {
    if (!agent?.support_contact) return null;

    const { name, email } = agent.support_contact;

    if (name && email) {
      return (
        <a href={`mailto:${email}`} className="text-primary hover:underline">
          {name}
        </a>
      );
    }

    if (email) {
      return (
        <a href={`mailto:${email}`} className="text-primary hover:underline">
          {email}
        </a>
      );
    }

    if (name) {
      return <span>{name}</span>;
    }

    return null;
  };
  const contactNode = formatContact();
  const authorName = agent?.authorName ?? 'Ethos Intelligence';

  return (
    <OGDialogContent className="max-h-[90vh] w-11/12 max-w-lg overflow-y-auto">
      {/* Agent avatar */}
      <div className="mt-6 flex justify-center">{renderAgentAvatar(agent, { size: 'xl' })}</div>

      {/* Agent name */}
      <div className="mt-3 text-center">
        <div className="agent-detail-title-row justify-center">
          <h2 className="text-2xl font-bold text-text-primary">
            {agent?.name || localize('com_agents_loading')}
          </h2>
          {agent && (
            <p className="agent-detail-title-byline">
              <span>{byLabel}</span>
              {contactNode ?? <span>{authorName}</span>}
            </p>
          )}
        </div>
      </div>

      {/* Agent description */}
      <div className="mt-4 whitespace-pre-wrap px-6 text-center text-base text-text-primary">
        {agent?.description}
      </div>

      {/* Action button */}
      <div className="mb-4 mt-6 flex justify-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={handleFavoriteClick}
          title={isFavorite ? localize('com_ui_unpin') : localize('com_ui_pin')}
          aria-label={isFavorite ? localize('com_ui_unpin') : localize('com_ui_pin')}
        >
          {isFavorite ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={handleCopyLink}
          title={localize('com_agents_copy_link')}
          aria-label={localize('com_agents_copy_link')}
        >
          <Link className="h-4 w-4" aria-hidden="true" />
        </Button>
        <Button className="w-full max-w-xs" onClick={handleStartChat} disabled={!agent}>
          {localize('com_agents_start_chat')}
        </Button>
      </div>
    </OGDialogContent>
  );
};

export default AgentDetailContent;
