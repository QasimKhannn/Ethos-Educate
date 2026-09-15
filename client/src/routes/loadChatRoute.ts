type ChatRouteModule = typeof import('./ChatRoute');

let chatRoutePromise: Promise<ChatRouteModule> | undefined;

export const loadChatRoute = () => {
  chatRoutePromise ??= import('./ChatRoute');
  return chatRoutePromise;
};
