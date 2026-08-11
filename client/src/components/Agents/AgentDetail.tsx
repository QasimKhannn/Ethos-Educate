import React, { useRef } from 'react';
import { Link, Pin, PinOff } from 'lucide-react';
import { OGDialog, OGDialogContent, Button, useToastContext } from '@librechat/client';
import type t from 'librechat-data-provider';
import { useLocalize, useFavorites } from '~/hooks';
import { renderAgentAvatar, getAgentDisplayName, normalizeAgentBrandText } from '~/utils';
import AgentOnboardingOverview from './AgentOnboardingOverview';
import { isMockMarketplaceAgent, renderMockMarketplaceAvatar } from './mockAgents';
import useStartAgentChat from './useStartAgentChat';

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
  const { showToast } = useToastContext();
  const dialogRef = useRef<HTMLDivElement>(null);
  const { isFavoriteAgent, toggleFavoriteAgent } = useFavorites();
  const startAgentChat = useStartAgentChat();
  const isFavorite = isFavoriteAgent(agent?.id);
  const isMockAgent = isMockMarketplaceAgent(agent);
  const agentDisplayName = getAgentDisplayName(agent);
  const byLabel = localize('com_ui_by_author', { 0: '' }).trim();

  const handleFavoriteClick = () => {
    if (agent) {
      toggleFavoriteAgent(agent.id);
    }
  };

  const handleStartChat = () => {
    startAgentChat(agent);
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
        className="agent-detail-dialog max-h-[90vh] w-[min(94vw,48rem)] overflow-y-auto p-0"
      >
        <div className="agent-detail-sheet">
          <div className="agent-detail-header">
            <div className="agent-detail-avatar">
              {renderMockMarketplaceAvatar(agent, { size: 'xl' }) ??
                renderAgentAvatar(agent, { size: 'xl' })}
            </div>
            <div className="agent-detail-heading">
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
            <AgentOnboardingOverview agent={agent} />
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
              disabled={!agent || isMockAgent}
            >
              {isMockAgent
                ? localize('com_agents_mock_preview_only')
                : localize('com_agents_start_chat')}
            </Button>
          </div>
        </div>
      </OGDialogContent>
    </OGDialog>
  );
};

export default AgentDetail;
