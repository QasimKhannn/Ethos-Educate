jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn(),
}));

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: jest.fn(),
}));

jest.mock('~/hooks', () => ({
  useDefaultConvo: jest.fn(),
  useLocalize: jest.fn(),
}));

jest.mock('~/Providers', () => ({
  useChatContext: jest.fn(),
}));

jest.mock('~/utils', () => ({
  clearMessagesCache: jest.fn(),
  getAgentAvatarImageUrl: jest.fn(),
  getAgentDisplayName: jest.fn(),
}));

import { act, renderHook } from '@testing-library/react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import type { Agent } from 'librechat-data-provider';
import { useDefaultConvo, useLocalize } from '~/hooks';
import { useChatContext } from '~/Providers';
import { getAgentAvatarImageUrl, getAgentDisplayName } from '~/utils';
import useStartAgentChat from '../useStartAgentChat';

describe('useStartAgentChat', () => {
  it('starts a normal agent chat without carrying Toolkit search parameters into the chat URL', () => {
    const newConversation = jest.fn();
    const agent = {
      id: 'poster-creator',
      name: 'Poster Creator',
      description: 'Creates school posters.',
    } as Agent;

    (useNavigate as jest.Mock).mockReturnValue(jest.fn());
    (useQueryClient as jest.Mock).mockReturnValue({
      getQueryData: jest.fn().mockReturnValue({ data: [] }),
      invalidateQueries: jest.fn(),
      setQueryData: jest.fn(),
    });
    (useDefaultConvo as jest.Mock).mockReturnValue(
      jest.fn().mockReturnValue({
        conversationId: 'new',
        endpoint: 'agents',
        agent_id: 'poster-creator',
      }),
    );
    (useLocalize as jest.Mock).mockReturnValue(jest.fn().mockReturnValue('Chat with agent'));
    (useChatContext as jest.Mock).mockReturnValue({
      conversation: null,
      newConversation,
    });
    (getAgentAvatarImageUrl as jest.Mock).mockReturnValue(null);
    (getAgentDisplayName as jest.Mock).mockReturnValue('Poster Creator');

    const { result } = renderHook(() => useStartAgentChat());

    act(() => {
      result.current(agent);
    });

    expect(newConversation).toHaveBeenCalledWith(
      expect.objectContaining({
        clearSearchParams: true,
        template: expect.objectContaining({
          conversationId: 'new',
          endpoint: 'agents',
          agent_id: 'poster-creator',
        }),
      }),
    );
  });

  it('prepares a fresh agent conversation before navigating an intake launch', () => {
    const navigate = jest.fn();
    const newConversation = jest.fn();
    const currentConversation = {
      conversationId: 'existing-conversation',
      endpoint: 'agents',
      agent_id: 'worksheet-agent',
    };
    const freshConversation = {
      conversationId: 'new',
      endpoint: 'agents',
      agent_id: 'worksheet-agent',
    };
    const agent = {
      id: 'worksheet-agent',
      name: 'Worksheet Generator',
      description: 'Creates classroom-ready worksheets.',
      intake_form: { template: 'worksheet' },
    } as Agent;

    (useNavigate as jest.Mock).mockReturnValue(navigate);
    (useQueryClient as jest.Mock).mockReturnValue({
      getQueryData: jest.fn().mockReturnValue({ data: [] }),
      invalidateQueries: jest.fn(),
      setQueryData: jest.fn(),
    });
    (useDefaultConvo as jest.Mock).mockReturnValue(jest.fn().mockReturnValue(freshConversation));
    (useLocalize as jest.Mock).mockReturnValue(jest.fn().mockReturnValue('Chat with agent'));
    (useChatContext as jest.Mock).mockReturnValue({
      conversation: currentConversation,
      newConversation,
    });
    (getAgentAvatarImageUrl as jest.Mock).mockReturnValue(null);
    (getAgentDisplayName as jest.Mock).mockReturnValue('Worksheet Generator');

    const { result } = renderHook(() => useStartAgentChat());

    act(() => {
      result.current(agent, 'Create a Grade 4 fractions worksheet.');
    });

    expect(newConversation).toHaveBeenCalledWith(
      expect.objectContaining({
        template: freshConversation,
        preset: expect.objectContaining({
          conversationId: 'new',
          endpoint: 'agents',
          agent_id: 'worksheet-agent',
        }),
      }),
    );
    expect(navigate).toHaveBeenCalledWith(
      expect.stringMatching(/^\/c\/new\?agent_id=worksheet-agent&intake=/),
    );
    expect(newConversation.mock.invocationCallOrder[0]).toBeLessThan(
      navigate.mock.invocationCallOrder[0],
    );
  });
});
