import React, { useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, Pin, PinOff } from 'lucide-react';
import { OGDialog, OGDialogContent, Button, useToastContext } from '@librechat/client';
import {
  QueryKeys,
  Constants,
  EModelEndpoint,
  PermissionBits,
  LocalStorageKeys,
  AgentListResponse,
} from 'librechat-data-provider';
import type t from 'librechat-data-provider';
import type { TranslationKeys } from '~/hooks';
import { useLocalize, useFavorites, useAgentCategories, useDefaultConvo } from '~/hooks';
import { useChatContext } from '~/Providers';
import {
  renderAgentAvatar,
  clearMessagesCache,
  getAgentAvatarImageUrl,
  getAgentDisplayName,
  normalizeAgentBrandText,
} from '~/utils';

interface SupportContact {
  name?: string;
  email?: string;
}

interface AgentWithSupport extends t.Agent {
  support_contact?: SupportContact;
}
interface AgentDetailProps {
  agent: AgentWithSupport; // The agent data to display
  isOpen: boolean; // Whether the detail dialog is open
  onClose: () => void; // Callback when dialog is closed
  isTourPreview?: boolean;
}

/**
 * Dialog for displaying agent details
 */
const AgentDetail: React.FC<AgentDetailProps> = ({ agent, isOpen, onClose, isTourPreview }) => {
  const localize = useLocalize();
  const queryClient = useQueryClient();
  const getDefaultConversation = useDefaultConvo();
  const { conversation, newConversation } = useChatContext();
  const { showToast } = useToastContext();
  const dialogRef = useRef<HTMLDivElement>(null);
  const { isFavoriteAgent, toggleFavoriteAgent } = useFavorites();
  const { categories } = useAgentCategories();
  const isFavorite = isFavoriteAgent(agent?.id);
  const agentDisplayName = getAgentDisplayName(agent);
  const categoryData = categories.find((category) => category.value === agent?.category);
  const byLabel = localize('com_ui_by_author', { 0: '' }).trim();

  const categoryLabel = useMemo(() => {
    if (categoryData?.label != null) {
      return categoryData.label.startsWith('com_')
        ? localize(categoryData.label as TranslationKeys)
        : categoryData.label;
    }

    return agent?.category
      ?.split(/[_-]/)
      .filter(Boolean)
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(' ');
  }, [agent?.category, categoryData?.label, localize]);

  const categoryDescription = useMemo(() => {
    const description =
      categoryData && 'description' in categoryData && typeof categoryData.description === 'string'
        ? categoryData.description
        : undefined;

    if (description == null) {
      return '';
    }

    return description.startsWith('com_') ? localize(description as TranslationKeys) : description;
  }, [categoryData, localize]);

  const handleFavoriteClick = () => {
    if (agent) {
      toggleFavoriteAgent(agent.id);
    }
  };

  const handleStartChat = () => {
    if (agent) {
      const agentAvatarUrl = getAgentAvatarImageUrl(agent);
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
          name: agentDisplayName,
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
    const displayName = normalizeAgentBrandText(name);

    if (name && email) {
      return (
        <a href={`mailto:${email}`} className="text-primary hover:underline">
          {displayName}
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
      return <span>{displayName}</span>;
    }

    return null;
  };
  const contactNode = formatContact();
  const authorName = normalizeAgentBrandText(agent?.authorName) || 'Ethos Intelligence';

  return (
    <OGDialog open={isOpen} onOpenChange={(open) => !open && onClose()} modal={!isTourPreview}>
      <OGDialogContent
        ref={dialogRef}
        data-tour-id="marketplace-agent-detail"
        data-tour-padding="-6"
        data-tour-radius="24"
        className="agent-detail-dialog max-h-[90vh] w-[min(92vw,42rem)] overflow-y-auto p-0"
      >
        <div className="agent-detail-sheet">
          <div className="agent-detail-header">
            <div className="agent-detail-avatar">{renderAgentAvatar(agent, { size: 'xl' })}</div>
            <div className="agent-detail-heading">
              <div className="agent-detail-meta-row">
                {categoryLabel ? (
                  <span className="agent-detail-category-badge">{categoryLabel}</span>
                ) : null}
              </div>
              <div className="agent-detail-title-row">
                <h2 className="agent-detail-title">
                  {agentDisplayName || localize('com_agents_loading')}
                </h2>
                {agent ? (
                  <p className="agent-detail-title-byline">
                    <span>{byLabel}</span>
                    {contactNode ?? <span>{authorName}</span>}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="agent-detail-body">
            <section className="agent-detail-section agent-detail-section--overview">
              <h3 className="agent-detail-section-title">
                {localize('com_agents_modal_overview')}
              </h3>
              <div className="agent-detail-description whitespace-pre-wrap">
                {agent?.description}
              </div>
            </section>

            {categoryDescription ? (
              <section className="agent-detail-section agent-detail-section--supporting">
                <h3 className="agent-detail-section-title">
                  {localize('com_agents_modal_best_for')}
                </h3>
                <p className="agent-detail-supporting-note">{categoryDescription}</p>
              </section>
            ) : null}
          </div>

          <div className="agent-detail-actions">
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
            <Button
              className="ml-auto min-w-[16rem] justify-center px-6 max-sm:ml-0 max-sm:w-full max-sm:min-w-0"
              onClick={handleStartChat}
              disabled={!agent}
            >
              {localize('com_agents_start_chat')}
            </Button>
          </div>
        </div>
      </OGDialogContent>
    </OGDialog>
  );
};

export default AgentDetail;
