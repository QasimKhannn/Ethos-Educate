import { Constants } from 'librechat-data-provider';

export type GenerationStartedResponse = {
  conversationId: string;
  status: 'started';
  streamId: string;
};

export const getPendingConversationHandoffKey = (conversationId: string) =>
  ['pending-conversation-handoff', conversationId] as const;

export const getPendingConversationPath = (response: GenerationStartedResponse): string | null => {
  if (response.conversationId === '' || response.conversationId === Constants.NEW_CONVO) {
    return null;
  }

  const url = new URL(window.location.href);
  if (url.pathname !== `/c/${Constants.NEW_CONVO}`) {
    return null;
  }

  return `/c/${encodeURIComponent(response.conversationId)}${url.search}${url.hash}`;
};
