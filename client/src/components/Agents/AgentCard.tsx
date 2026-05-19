import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { Label, OGDialog, OGDialogTrigger } from '@librechat/client';
import type t from 'librechat-data-provider';

import { useLocalize, TranslationKeys, useAgentCategories } from '~/hooks';
import { cn, renderAgentAvatar, getContactDisplayName, getAgentDisplayName } from '~/utils';
import AgentDetailContent from './AgentDetailContent';

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
  const shouldReduceMotion = useReducedMotion();
  const { categories } = useAgentCategories();
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const categoryLabel = useMemo(() => {
    if (!agent.category) return '';

    const category = categories.find((cat) => cat.value === agent.category);
    if (category) {
      if (category.label && category.label.startsWith('com_')) {
        return localize(category.label as TranslationKeys);
      }
      return category.label;
    }

    return agent.category.charAt(0).toUpperCase() + agent.category.slice(1);
  }, [agent.category, categories, localize]);

  const displayName = getContactDisplayName(agent);
  const agentDisplayName = getAgentDisplayName(agent);
  const panelId = `agent-${agent.id}-panel`;
  const triggerId = `agent-${agent.id}-trigger`;
  const hasLongDescription = (agent.description?.trim().length ?? 0) > 110;
  const shouldShowHeaderDescription =
    Boolean(agent.description) && (!isExpanded || !hasLongDescription);
  const headerDescriptionId = shouldShowHeaderDescription
    ? `agent-${agent.id}-description`
    : undefined;
  const shouldShowExpandedDescription =
    Boolean(agent.description) && isExpanded && hasLongDescription;
  const conversationStarters = useMemo(
    () =>
      (agent.conversation_starters ?? [])
        .filter((starter) => starter.trim().length > 0)
        .slice(0, 3),
    [agent.conversation_starters],
  );
  const contentTransition = shouldReduceMotion
    ? { duration: 0 }
    : { duration: 0.24, ease: [0.22, 1, 0.36, 1] as const };
  const contentInnerTransition = shouldReduceMotion
    ? { duration: 0 }
    : { duration: 0.2, ease: [0.22, 1, 0.36, 1] as const, delay: 0.04 };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open && onSelect) {
      onSelect(agent);
    }
  };

  const handleToggleExpand = () => {
    onClick?.();
    setIsExpanded((currentValue) => {
      const nextValue = !currentValue;

      if (nextValue && onSelect) {
        onSelect(agent);
      }

      return nextValue;
    });
  };

  return (
    <OGDialog open={isOpen} onOpenChange={handleOpenChange}>
      <article
        className="agent-card-shell group overflow-hidden rounded-xl border"
        data-expanded={isExpanded ? 'true' : 'false'}
        data-view-mode={viewMode}
      >
        <button
          id={triggerId}
          type="button"
          tabIndex={0}
          className={cn('agent-card-trigger w-full text-left', className)}
          aria-label={localize('com_agents_agent_card_label', {
            name: agentDisplayName,
            description: agent.description ?? '',
          })}
          aria-describedby={headerDescriptionId}
          aria-controls={panelId}
          aria-expanded={isExpanded}
          data-view-mode={viewMode}
          onClick={handleToggleExpand}
        >
          <div className="agent-card-avatar-shell flex h-[3.95rem] w-[3.95rem] shrink-0 items-center justify-center rounded-xl border border-border-light bg-surface-secondary">
            {renderAgentAvatar(agent, {
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
            <div className="agent-card-meta-row">
              {categoryLabel ? (
                <span className="agent-card-category-pill shrink-0 rounded-md border border-border-light bg-surface-primary px-2 py-1 text-[11px] font-medium text-text-secondary">
                  {categoryLabel}
                </span>
              ) : null}
              {displayName ? (
                <div className="agent-card-byline text-xs text-text-tertiary">
                  <span className="truncate">
                    {localize('com_ui_by_author', { 0: displayName })}
                  </span>
                </div>
              ) : null}
            </div>
            {shouldShowHeaderDescription ? (
              <p
                id={headerDescriptionId}
                className="agent-card-description mt-1 text-sm leading-6 text-text-secondary"
                aria-label={localize('com_agents_description_card', {
                  description: agent.description,
                })}
              >
                {agent.description}
              </p>
            ) : null}
          </div>
          <ChevronDown className="agent-card-chevron mt-1 h-4 w-4 shrink-0 text-text-tertiary" />
        </button>

        <AnimatePresence initial={false}>
          {isExpanded ? (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={contentTransition}
              className="overflow-hidden"
            >
              <motion.div
                id={panelId}
                role="region"
                aria-labelledby={triggerId}
                className="agent-card-content"
                initial={{ y: -6, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -4, opacity: 0 }}
                transition={contentInnerTransition}
              >
                {conversationStarters.length > 0 ? (
                  <div>
                    <h3 className="text-xs font-medium uppercase tracking-[0.08em] text-text-tertiary">
                      {localize('com_assistants_conversation_starters')}
                    </h3>
                    <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-6 text-text-secondary">
                      {conversationStarters.map((starter) => (
                        <li key={starter}>{starter}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {shouldShowExpandedDescription ? (
                  <div className="agent-card-description-block">
                    <p className="text-sm leading-6 text-text-secondary">{agent.description}</p>
                  </div>
                ) : null}
                <div className="mt-4">
                  <OGDialogTrigger asChild>
                    <button
                      type="button"
                      className="agent-card-details-button"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {localize('com_agents_see_more')}
                    </button>
                  </OGDialogTrigger>
                </div>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </article>

      <AgentDetailContent agent={agent} />
    </OGDialog>
  );
};

export default AgentCard;
