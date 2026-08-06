import React from 'react';
import type t from 'librechat-data-provider';
import { useLocalize } from '~/hooks';
import { getMockMarketplaceAgentOnboarding } from './mockAgents';

interface AgentOnboardingOverviewProps {
  agent?: t.Agent | null;
  supportingNote?: string;
}

const getConversationStarters = (agent?: t.Agent | null): string[] => {
  const starters: string[] = [];

  for (const starter of agent?.conversation_starters ?? []) {
    const trimmedStarter = starter.trim();

    if (trimmedStarter.length === 0) {
      continue;
    }

    starters.push(trimmedStarter);

    if (starters.length === 3) {
      break;
    }
  }

  return starters;
};

const AgentOnboardingOverview: React.FC<AgentOnboardingOverviewProps> = ({
  agent,
  supportingNote,
}) => {
  const localize = useLocalize();
  const description = agent?.description?.trim() || localize('com_agents_modal_purpose_fallback');
  const conversationStarters = getConversationStarters(agent);
  const agentOnboarding = getMockMarketplaceAgentOnboarding(agent, localize);
  const requiredInputs =
    agentOnboarding?.inputs ?? localize('com_agents_modal_required_inputs_description');
  const expectedOutput =
    agentOnboarding?.output ?? localize('com_agents_modal_expected_output_description');

  return (
    <div className="agent-onboarding-overview" data-testid="agent-onboarding-overview">
      <section className="agent-detail-section agent-onboarding-purpose">
        <h3 className="agent-detail-section-title">{localize('com_agents_modal_purpose')}</h3>
        <p className="agent-detail-description whitespace-pre-wrap">{description}</p>
      </section>

      <div className="agent-onboarding-contract">
        <section className="agent-onboarding-contract-card">
          <div className="agent-onboarding-contract-heading">
            <span className="agent-onboarding-contract-index" aria-hidden="true">
              01
            </span>
            <h3>{localize('com_agents_modal_required_inputs')}</h3>
          </div>
          <p>{requiredInputs}</p>
        </section>

        <section className="agent-onboarding-contract-card">
          <div className="agent-onboarding-contract-heading">
            <span className="agent-onboarding-contract-index" aria-hidden="true">
              02
            </span>
            <h3>{localize('com_agents_modal_expected_output')}</h3>
          </div>
          <p>{expectedOutput}</p>
        </section>
      </div>

      {supportingNote ? (
        <section className="agent-detail-section agent-onboarding-supporting">
          <h3 className="agent-detail-section-title">{localize('com_agents_modal_best_for')}</h3>
          <p className="agent-detail-supporting-note">{supportingNote}</p>
        </section>
      ) : null}

      {conversationStarters.length > 0 ? (
        <section className="agent-detail-section agent-detail-section--starters">
          <h3 className="agent-detail-section-title">{localize('com_agents_modal_try_asking')}</h3>
          <ul className="agent-detail-starters">
            {conversationStarters.map((starter) => (
              <li key={starter} className="agent-detail-starter-item">
                {starter}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
};

export default AgentOnboardingOverview;
