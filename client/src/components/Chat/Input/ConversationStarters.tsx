import { useMemo, useCallback } from 'react';
import { EModelEndpoint, Constants } from 'librechat-data-provider';
import type t from 'librechat-data-provider';
import {
  useChatContext,
  useChatFormContext,
  useAgentsMapContext,
  useAssistantsMapContext,
} from '~/Providers';
import { useGetAssistantDocsQuery, useGetEndpointsQuery } from '~/data-provider';
import { getIconEndpoint, getEntity } from '~/utils';
import { mainTextareaId } from '~/common';
import { useLocalize } from '~/hooks';

type StarterCard = {
  label: string;
  prompt: string;
  description?: string;
};

const getAgentPromptCards = (entity?: t.Agent | t.Assistant | null): StarterCard[] => {
  if (!entity || !('recommended_prompts' in entity)) {
    return [];
  }

  if (entity.show_recommended_prompts === false) {
    return [];
  }

  const prompts = entity.recommended_prompts ?? [];
  const cards: StarterCard[] = [];

  for (const prompt of prompts) {
    const label = prompt.label?.trim();
    const promptText = prompt.prompt?.trim();
    const description = prompt.description?.trim();

    if (!label || !promptText) {
      continue;
    }

    cards.push({
      label,
      prompt: promptText,
      ...(description ? { description } : {}),
    });

    if (cards.length === 3) {
      break;
    }
  }

  return cards;
};

const getStarterCards = (starters: string[]): StarterCard[] =>
  starters
    .map((starter) => starter.trim())
    .filter(Boolean)
    .slice(0, Constants.MAX_CONVO_STARTERS)
    .map((starter) => ({
      label: starter,
      prompt: starter,
    }));

const ConversationStarters = () => {
  const { conversation } = useChatContext();
  const agentsMap = useAgentsMapContext();
  const assistantMap = useAssistantsMapContext();
  const localize = useLocalize();
  const { data: endpointsConfig } = useGetEndpointsQuery();

  const endpointType = useMemo(() => {
    let ep = conversation?.endpoint ?? '';
    if (ep === EModelEndpoint.azureOpenAI) {
      ep = EModelEndpoint.openAI;
    }
    return getIconEndpoint({
      endpointsConfig,
      iconURL: conversation?.iconURL,
      endpoint: ep,
    });
  }, [conversation?.endpoint, conversation?.iconURL, endpointsConfig]);

  const { data: documentsMap = new Map() } = useGetAssistantDocsQuery(endpointType, {
    select: (data) => new Map(data.map((dbA) => [dbA.assistant_id, dbA])),
  });

  const { entity, isAgent } = getEntity({
    endpoint: endpointType,
    agentsMap,
    assistantMap,
    agent_id: conversation?.agent_id,
    assistant_id: conversation?.assistant_id,
  });

  const starterCards = useMemo(() => {
    const agentPromptCards = getAgentPromptCards(entity);
    if (agentPromptCards.length > 0) {
      return agentPromptCards;
    }

    if (entity?.conversation_starters?.length) {
      return getStarterCards(entity.conversation_starters);
    }

    if (isAgent) {
      return [];
    }

    return getStarterCards(documentsMap.get(entity?.id ?? '')?.conversation_starters ?? []);
  }, [documentsMap, isAgent, entity]);

  const methods = useChatFormContext();
  const setConversationStarter = useCallback(
    (text: string) => {
      methods.setValue('text', text, { shouldDirty: true, shouldValidate: true });
      methods.setFocus('text');
      window.requestAnimationFrame(() => document.getElementById(mainTextareaId)?.focus());
    },
    [methods],
  );

  if (!starterCards.length) {
    return null;
  }

  return (
    <div
      className="chat-conversation-starters"
      aria-label={localize('com_ui_agent_recommended_prompts')}
    >
      {starterCards.map((starter, index) => (
        <button
          key={`${starter.label}-${index}`}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setConversationStarter(starter.prompt)}
          className="chat-conversation-starter"
          type="button"
        >
          <span className="chat-conversation-starter-label">{starter.label}</span>
          {starter.description ? (
            <span className="chat-conversation-starter-description">{starter.description}</span>
          ) : null}
        </button>
      ))}
    </div>
  );
};

export default ConversationStarters;
