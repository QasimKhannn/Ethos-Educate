import React, { useState } from 'react';
import { Label, OGDialog, OGDialogTrigger } from '@librechat/client';
import type t from 'librechat-data-provider';
import { useLocalize } from '~/hooks';
import {
  cn,
  renderAgentAvatar,
  getContactDisplayName,
  getAgentDisplayName,
  getAgentToolkitDescription,
} from '~/utils';
import AgentDetailContent from './AgentDetailContent';
import { renderMockMarketplaceAvatar } from './mockAgents';

interface AgentCardProps {
  agent: t.Agent;
  onSelect?: (agent: t.Agent) => void;
  onClick?: () => void;
  className?: string;
  viewMode?: 'compact' | 'large';
}

/**
 * Card component to display agent information with integrated detail dialog
 */
const AgentCard: React.FC<AgentCardProps> = ({
  agent,
  onSelect,
  onClick,
  className = '',
  viewMode = 'compact',
}) => {
  const localize = useLocalize();
  const [isOpen, setIsOpen] = useState(false);

  const displayName = getContactDisplayName(agent);
  const agentDisplayName = getAgentDisplayName(agent);
  const toolkitDescription = getAgentToolkitDescription(agent);
  const triggerId = `agent-${agent.id}-trigger`;
  const headerDescriptionId = toolkitDescription ? `agent-${agent.id}-description` : undefined;
  const shouldOpenDirectly = onClick != null;

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open && onSelect) {
      onSelect(agent);
    }
  };

  const handleCardClick = () => {
    onClick?.();
  };

  const cardButton = (
    <button
      id={triggerId}
      type="button"
      tabIndex={0}
      className={cn('agent-card-trigger w-full text-left', className)}
      aria-label={localize('com_agents_agent_card_label', {
        name: agentDisplayName,
        description: toolkitDescription,
      })}
      aria-describedby={headerDescriptionId}
      aria-haspopup={shouldOpenDirectly ? undefined : 'dialog'}
      data-view-mode={viewMode}
      onClick={shouldOpenDirectly ? handleCardClick : undefined}
    >
      <div className="agent-card-avatar-shell flex h-[3.95rem] w-[3.95rem] shrink-0 items-center justify-center rounded-xl border border-border-light bg-surface-secondary">
        {renderMockMarketplaceAvatar(agent) ??
          renderAgentAvatar(agent, {
            size: 'fill',
            showBorder: false,
            fit: 'contain',
            shape: 'rounded',
            visualScale: 'contained',
            className: 'agent-card-art',
          })}
      </div>
      <div className="agent-card-copy min-w-0">
        <div className="agent-card-title-row">
          <Label className="agent-card-title line-clamp-3 text-base font-semibold text-text-primary md:line-clamp-2 md:text-lg">
            {agentDisplayName}
          </Label>
        </div>
        {displayName ? (
          <div className="agent-card-byline text-xs text-text-tertiary">
            <span className="truncate">{localize('com_ui_by_author', { 0: displayName })}</span>
          </div>
        ) : null}
        {toolkitDescription ? (
          <p
            id={headerDescriptionId}
            className="agent-card-description mt-1 text-sm leading-6 text-text-secondary"
            aria-label={localize('com_agents_description_card', {
              description: toolkitDescription,
            })}
          >
            {toolkitDescription}
          </p>
        ) : null}
      </div>
    </button>
  );

  if (shouldOpenDirectly) {
    return (
      <article
        className="agent-card-shell group overflow-hidden rounded-xl border"
        data-view-mode={viewMode}
      >
        {cardButton}
      </article>
    );
  }

  return (
    <OGDialog open={isOpen} onOpenChange={handleOpenChange}>
      <article
        className="agent-card-shell group overflow-hidden rounded-xl border"
        data-view-mode={viewMode}
      >
        <OGDialogTrigger asChild>{cardButton}</OGDialogTrigger>
      </article>

      <AgentDetailContent agent={agent} />
    </OGDialog>
  );
};

export default AgentCard;
