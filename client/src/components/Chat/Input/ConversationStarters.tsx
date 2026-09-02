import { useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { EModelEndpoint, Constants } from 'librechat-data-provider';
import type t from 'librechat-data-provider';
import {
  useChatContext,
  useChatFormContext,
  useAgentsMapContext,
  useAssistantsMapContext,
} from '~/Providers';
import { useGetAssistantDocsQuery, useGetEndpointsQuery } from '~/data-provider';
import { getIconEndpoint, getEntity, getEntityEndpoint } from '~/utils';
import { mainTextareaId } from '~/common';
import { useLocalize } from '~/hooks';

type StarterCard = {
  label: string;
  prompt?: string;
  description?: string;
  action?: 'open-toolkit';
};

const lessonPlanBuilderAgentIds = new Set(['agent_U34zrvm73tQ5iFaHpwiol']);

const getEntitySlug = (name: string | null | undefined): string =>
  name
    ?.trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\(([^)]*)\)/g, ' $1 ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') ?? '';

const isLessonPlanBuilderEntity = (entity?: t.Agent | t.Assistant | null): boolean => {
  if (!entity) {
    return false;
  }

  return (
    lessonPlanBuilderAgentIds.has(entity.id) || getEntitySlug(entity.name) === 'lesson-plan-builder'
  );
};

const getAgentPromptCards = (entity?: t.Agent | t.Assistant | null): StarterCard[] => {
  if (!entity || !('recommended_prompts' in entity)) {
    return [];
  }

  if (entity.show_recommended_prompts === false || isLessonPlanBuilderEntity(entity)) {
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
  const navigate = useNavigate();
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
    endpoint: getEntityEndpoint({
      conversationEndpoint: conversation?.endpoint,
      displayEndpoint: endpointType,
    }),
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

    const documentStarters = getStarterCards(
      documentsMap.get(entity?.id ?? '')?.conversation_starters ?? [],
    );
    if (documentStarters.length > 0) {
      return documentStarters;
    }

    return [
      {
        label: localize('com_ui_educator_starter_lesson_label'),
        description: localize('com_ui_educator_starter_lesson_description'),
        prompt: localize('com_ui_educator_starter_lesson_prompt'),
      },
      {
        label: localize('com_ui_educator_starter_feedback_label'),
        description: localize('com_ui_educator_starter_feedback_description'),
        prompt: localize('com_ui_educator_starter_feedback_prompt'),
      },
      {
        label: localize('com_ui_educator_starter_toolkit_label'),
        description: localize('com_ui_educator_starter_toolkit_description'),
        action: 'open-toolkit',
      },
    ];
  }, [documentsMap, entity, isAgent, localize]);

  const methods = useChatFormContext();
  const setConversationStarter = useCallback(
    (text: string) => {
      methods.setValue('text', text, { shouldDirty: true, shouldValidate: true });
      methods.setFocus('text');
      window.requestAnimationFrame(() => document.getElementById(mainTextareaId)?.focus());
    },
    [methods],
  );
  const handleStarterClick = useCallback(
    (starter: StarterCard) => {
      if (starter.action === 'open-toolkit') {
        navigate('/agents');
        return;
      }

      if (starter.prompt) {
        setConversationStarter(starter.prompt);
      }
    },
    [navigate, setConversationStarter],
  );

  if (!starterCards.length) {
    return null;
  }

  return (
    <section
      className="chat-conversation-starters-section"
      aria-label={localize('com_ui_agent_recommended_prompts')}
    >
      <div className="chat-conversation-starters">
        {starterCards.map((starter, index) => (
          <button
            key={`${starter.label}-${index}`}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => handleStarterClick(starter)}
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
    </section>
  );
};

export default ConversationStarters;
