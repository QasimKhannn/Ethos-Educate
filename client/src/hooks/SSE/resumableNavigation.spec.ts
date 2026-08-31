import { Constants } from 'librechat-data-provider';
import { replacePendingConversationUrl } from './resumableNavigation';

describe('replacePendingConversationUrl', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/c/new?agent_id=agent-1#running');
  });

  test('replaces a new-chat URL as soon as the backend returns its conversation ID', () => {
    const replaced = replacePendingConversationUrl({
      conversationId: 'conversation-123',
      status: 'started',
      streamId: 'conversation-123',
    });

    expect(replaced).toBe(true);
    expect(window.location.pathname).toBe('/c/conversation-123');
    expect(window.location.search).toBe('?agent_id=agent-1');
    expect(window.location.hash).toBe('#running');
  });

  test('does not replace an existing conversation URL', () => {
    window.history.replaceState({}, '', '/c/conversation-123');

    const replaced = replacePendingConversationUrl({
      conversationId: 'conversation-456',
      status: 'started',
      streamId: 'conversation-456',
    });

    expect(replaced).toBe(false);
    expect(window.location.pathname).toBe('/c/conversation-123');
  });
});
