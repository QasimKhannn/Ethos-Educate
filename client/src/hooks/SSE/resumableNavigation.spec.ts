import {
  getPendingConversationHandoffKey,
  getPendingConversationPath,
} from './resumableNavigation';

describe('getPendingConversationHandoffKey', () => {
  test('scopes the handoff marker to the persisted conversation', () => {
    expect(getPendingConversationHandoffKey('conversation-123')).toEqual([
      'pending-conversation-handoff',
      'conversation-123',
    ]);
  });
});

describe('getPendingConversationPath', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/c/new?agent_id=agent-1#running');
  });

  test('returns the persisted conversation path for a new chat', () => {
    const path = getPendingConversationPath({
      conversationId: 'conversation-123',
      status: 'started',
      streamId: 'conversation-123',
    });

    expect(path).toBe('/c/conversation-123?agent_id=agent-1#running');
  });

  test('does not return a path for an existing conversation URL', () => {
    window.history.replaceState({}, '', '/c/conversation-123');

    const path = getPendingConversationPath({
      conversationId: 'conversation-456',
      status: 'started',
      streamId: 'conversation-456',
    });

    expect(path).toBeNull();
    expect(window.location.pathname).toBe('/c/conversation-123');
  });
});
