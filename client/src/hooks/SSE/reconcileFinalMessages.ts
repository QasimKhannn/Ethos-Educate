import type { TMessage } from 'librechat-data-provider';

type ReconcileFinalMessagesParams = {
  messages: TMessage[];
  requestMessage?: TMessage | null;
  responseMessage?: TMessage | null;
  isRegenerate: boolean;
  isEdited?: boolean;
  isContinued?: boolean;
};

const isProvisionalResponse = (message: TMessage, requestMessage: TMessage) =>
  !message.isCreatedByUser &&
  message.parentMessageId === requestMessage.messageId &&
  message.messageId === `${requestMessage.messageId}_`;

export function reconcileFinalMessages({
  messages,
  requestMessage,
  responseMessage,
  isRegenerate,
  isEdited,
  isContinued,
}: ReconcileFinalMessagesParams): TMessage[] {
  if (isRegenerate && responseMessage) {
    return [...messages, responseMessage];
  }

  if (!requestMessage || !responseMessage) {
    return [];
  }

  if (isEdited || isContinued) {
    return [...messages, requestMessage, responseMessage];
  }

  let hasRequestMessage = false;
  const finalMessages: TMessage[] = [];

  for (const message of messages) {
    if (message.messageId === requestMessage.messageId) {
      if (!hasRequestMessage) {
        finalMessages.push(requestMessage);
        hasRequestMessage = true;
      }
      continue;
    }

    if (
      message.messageId === responseMessage.messageId ||
      isProvisionalResponse(message, requestMessage)
    ) {
      continue;
    }

    finalMessages.push(message);
  }

  if (!hasRequestMessage) {
    finalMessages.push(requestMessage);
  }

  finalMessages.push(responseMessage);
  return finalMessages;
}
