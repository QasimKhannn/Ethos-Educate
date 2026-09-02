import React from 'react';
import { render, screen } from '@testing-library/react';
import { EModelEndpoint } from 'librechat-data-provider';
import type { Agent } from 'librechat-data-provider';
import ConversationStarters from '../ConversationStarters';

let mockConversation: {
  endpoint: EModelEndpoint | string;
  agent_id?: string;
  iconURL?: string;
};

let mockAgentsMap: Record<string, Agent> = {};

jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
}));

jest.mock('~/Providers', () => ({
  useChatContext: () => ({ conversation: mockConversation }),
  useChatFormContext: () => ({ setValue: jest.fn(), setFocus: jest.fn() }),
  useAgentsMapContext: () => mockAgentsMap,
  useAssistantsMapContext: () => ({}),
}));

jest.mock('~/data-provider', () => ({
  useGetEndpointsQuery: () => ({ data: { 'gpt-5-chat': {} } }),
  useGetAssistantDocsQuery: () => ({ data: new Map() }),
}));

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string) => key,
}));

describe('ConversationStarters', () => {
  beforeEach(() => {
    mockConversation = { endpoint: EModelEndpoint.openAI };
    mockAgentsMap = {};
  });

  it('does not render home-page cards for an agent displayed with a model icon', () => {
    mockConversation = {
      endpoint: EModelEndpoint.agents,
      agent_id: 'poster-creator',
      iconURL: 'gpt-5-chat',
    };
    mockAgentsMap = {
      'poster-creator': {
        id: 'poster-creator',
        name: 'Poster Creator',
        description: null,
        created_at: 0,
        avatar: null,
        provider: EModelEndpoint.openAI,
        model: 'gpt-5-chat',
        model_parameters: {},
        recommended_prompts: [],
      },
    };

    render(<ConversationStarters />);

    expect(screen.queryByText('com_ui_educator_starter_lesson_label')).not.toBeInTheDocument();
    expect(screen.queryByText('com_ui_educator_starter_feedback_label')).not.toBeInTheDocument();
    expect(screen.queryByText('com_ui_educator_starter_toolkit_label')).not.toBeInTheDocument();
  });

  it('keeps the home-page cards for a normal chat', () => {
    render(<ConversationStarters />);

    expect(screen.getByText('com_ui_educator_starter_lesson_label')).toBeInTheDocument();
    expect(screen.getByText('com_ui_educator_starter_feedback_label')).toBeInTheDocument();
    expect(screen.getByText('com_ui_educator_starter_toolkit_label')).toBeInTheDocument();
  });
});
