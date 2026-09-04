import { ContentTypes } from 'librechat-data-provider';
import type { TMessage } from 'librechat-data-provider';
import { reconcileFinalMessages } from '../reconcileFinalMessages';

const createMessage = (overrides: Partial<TMessage>): TMessage =>
  ({
    messageId: 'message-id',
    parentMessageId: 'parent-id',
    conversationId: 'conversation-id',
    isCreatedByUser: false,
    text: '',
    sender: 'Ethos-Pro',
    ...overrides,
  }) as TMessage;

describe('reconcileFinalMessages', () => {
  const requestMessage = createMessage({
    messageId: 'user-message-id',
    isCreatedByUser: true,
    sender: 'User',
    text: 'Generate an image of a flying monkey',
  });

  const provisionalResponse = createMessage({
    messageId: 'user-message-id_',
    parentMessageId: requestMessage.messageId,
    content: [
      {
        type: 'tool_call',
        tool_call: { id: 'tool-id', name: 'generate_images', args: '{}' },
      },
    ],
  });

  const finalResponse = createMessage({
    messageId: 'completed-response-id',
    parentMessageId: requestMessage.messageId,
    text: 'Your image is ready.',
  });

  it('replaces the resumed provisional tool response with the final response', () => {
    const messages = [
      createMessage({
        messageId: 'previous-response-id',
        parentMessageId: 'previous-user-id',
        text: 'Previous response',
      }),
      requestMessage,
      provisionalResponse,
    ];

    const result = reconcileFinalMessages({
      messages,
      requestMessage,
      responseMessage: finalResponse,
      isRegenerate: false,
    });

    expect(result.map((message) => message.messageId)).toEqual([
      'previous-response-id',
      'user-message-id',
      'completed-response-id',
    ]);
  });

  it('preserves intentional regenerate branches', () => {
    const result = reconcileFinalMessages({
      messages: [requestMessage, provisionalResponse],
      requestMessage,
      responseMessage: finalResponse,
      isRegenerate: true,
    });

    expect(result.map((message) => message.messageId)).toEqual([
      'user-message-id',
      'user-message-id_',
      'completed-response-id',
    ]);
  });

  it('removes a persisted unfinished duplicate tool sibling when the final sibling completes', () => {
    const staleResponse = createMessage({
      messageId: 'stale-response-id',
      parentMessageId: requestMessage.messageId,
      content: [
        {
          type: ContentTypes.TOOL_CALL,
          tool_call: { id: 'stale-tool-id', name: 'generate_images', args: '{}', progress: 0.1 },
        },
      ],
    });
    const completedResponse = createMessage({
      messageId: 'completed-response-id',
      parentMessageId: requestMessage.messageId,
      content: [
        {
          type: ContentTypes.TOOL_CALL,
          tool_call: { id: 'completed-tool-id', name: 'generate_images', args: '{}', progress: 1 },
        },
      ],
    });

    const result = reconcileFinalMessages({
      messages: [requestMessage, staleResponse],
      requestMessage,
      responseMessage: completedResponse,
      isRegenerate: false,
    });

    expect(result.map((message) => message.messageId)).toEqual([
      'user-message-id',
      'completed-response-id',
    ]);
  });
});
