type EssayGraderRouteModule = typeof import('./EssayGraderRoute');

let routeModulePromise: Promise<EssayGraderRouteModule> | undefined;

export const loadEssayGraderRoute = () => {
  routeModulePromise ??= import('./EssayGraderRoute');
  return routeModulePromise;
};
