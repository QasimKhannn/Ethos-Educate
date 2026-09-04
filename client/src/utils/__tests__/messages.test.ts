import { QueryClient } from '@tanstack/react-query';
import { Constants, ContentTypes, QueryKeys } from 'librechat-data-provider';
import type { TMessage } from 'librechat-data-provider';
import { clearMessagesCache, filterStaleToolCallSiblings } from '../messages';

const createToolMessage = ({
  messageId,
  progress,
  name = 'generate_images',
  output,
  text = '',
}: {
  messageId: string;
  progress?: number;
  name?: string;
  output?: string;
  text?: string;
}): TMessage =>
  ({
    messageId,
    parentMessageId: 'user-message-id',
    conversationId: 'conversation-id',
    isCreatedByUser: false,
    text,
    content: [
      {
        type: ContentTypes.TOOL_CALL,
        tool_call: {
          id: `${messageId}-tool-id`,
          name,
          args: '{}',
          progress,
          output,
        },
      },
    ],
  }) as TMessage;

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

describe('filterStaleToolCallSiblings', () => {
  it('hides an unfinished duplicate tool placeholder after the same tool completes', () => {
    const staleToolCall = createToolMessage({ messageId: 'stale-message', progress: 0.1 });
    const completedToolCall = createToolMessage({ messageId: 'completed-message', progress: 1 });

    expect(filterStaleToolCallSiblings([staleToolCall, completedToolCall])).toEqual([
      completedToolCall,
    ]);
  });

  it('preserves genuine tool errors and completed regenerations', () => {
    const failedToolCall = createToolMessage({
      messageId: 'failed-message',
      output: 'Error: The image provider rejected the request.',
    });
    const completedToolCall = createToolMessage({ messageId: 'completed-message', progress: 1 });
    const regeneratedToolCall = createToolMessage({
      messageId: 'regenerated-message',
      progress: 1,
    });

    expect(
      filterStaleToolCallSiblings([failedToolCall, completedToolCall, regeneratedToolCall]),
    ).toEqual([failedToolCall, completedToolCall, regeneratedToolCall]);
  });

  it('does not hide an unfinished call for a different tool', () => {
    const staleToolCall = createToolMessage({
      messageId: 'stale-message',
      name: 'web_search',
      progress: 0.1,
    });
    const completedToolCall = createToolMessage({ messageId: 'completed-message', progress: 1 });

    expect(filterStaleToolCallSiblings([staleToolCall, completedToolCall])).toEqual([
      staleToolCall,
      completedToolCall,
    ]);
  });
});
