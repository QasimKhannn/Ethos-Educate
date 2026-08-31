import { Constants } from 'librechat-data-provider';

export type GenerationStartedResponse = {
  conversationId: string;
  status: 'started';
  streamId: string;
};

export const replacePendingConversationUrl = (response: GenerationStartedResponse): boolean => {
  if (response.conversationId === '' || response.conversationId === Constants.NEW_CONVO) {
    return false;
  }

  const url = new URL(window.location.href);
  if (url.pathname !== `/c/${Constants.NEW_CONVO}`) {
    return false;
  }

  const path = `/c/${encodeURIComponent(response.conversationId)}${url.search}${url.hash}`;
  window.history.replaceState(window.history.state, '', path);
  return true;
};
