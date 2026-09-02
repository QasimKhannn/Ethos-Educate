import { QueryClient } from '@tanstack/react-query';
import { Constants, QueryKeys } from 'librechat-data-provider';
import { clearMessagesCache } from '../messages';

describe('clearMessagesCache', () => {
  it('removes the current and new-chat message queries instead of caching empty arrays', () => {
    const queryClient = new QueryClient();
    const conversationId = 'conversation-1';

    queryClient.setQueryData([QueryKeys.messages, conversationId], [{ messageId: 'message-1' }]);
    queryClient.setQueryData([QueryKeys.messages, Constants.NEW_CONVO], [{ messageId: 'draft-1' }]);

    clearMessagesCache(queryClient, conversationId);

    expect(queryClient.getQueryData([QueryKeys.messages, conversationId])).toBeUndefined();
    expect(queryClient.getQueryData([QueryKeys.messages, Constants.NEW_CONVO])).toBeUndefined();
  });
});
