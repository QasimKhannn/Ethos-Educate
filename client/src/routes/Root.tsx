import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import type { ContextType } from '~/common';
import {
  useSearchEnabled,
  useAssistantsMap,
  useAuthContext,
  useAgentsMap,
  useFileMap,
} from '~/hooks';
import {
  PromptGroupsProvider,
  AssistantsMapContext,
  AgentsMapContext,
  SetConvoProvider,
  FileMapContext,
} from '~/Providers';
import {
  useUserTermsQuery,
  useGetStartupConfig,
  useCompleteOnboardingTourMutation,
  useOnboardingTourStatusQuery,
} from '~/data-provider';
import { Nav, MobileNav } from '~/components/Nav';
import FirstLoginTour from '~/components/Onboarding/FirstLoginTour';
import { TermsAndConditionsModal } from '~/components/ui';
import { useHealthCheck } from '~/data-provider';
import { Banner } from '~/components/Banners';

export default function Root() {
  const [showTerms, setShowTerms] = useState(false);
  const [bannerHeight, setBannerHeight] = useState(0);
  const [navVisible, setNavVisible] = useState(() => {
    const savedNavVisible = localStorage.getItem('navVisible');
    return savedNavVisible !== null ? JSON.parse(savedNavVisible) : true;
  });

  const { user, isAuthenticated, logout } = useAuthContext();
  const backendQueriesEnabled = isAuthenticated;
  // cowork — the dedicated Cowork section renders its own rail, so hide the chat
  // sidebar ONLY for /cowork routes. All other routes are unaffected.
  const location = useLocation();
  const isCoworkRoute = location.pathname.startsWith('/cowork');
  const onboardingStorageKey = useMemo(() => {
    if (!user?.id) {
      return null;
    }

    return `first-login-tour:v2:${user.id}`;
  }, [user?.id]);

  // Global health check - runs once per authenticated session
  useHealthCheck(backendQueriesEnabled);

  const assistantsMap = useAssistantsMap({ isAuthenticated: backendQueriesEnabled });
  const agentsMap = useAgentsMap({ isAuthenticated: backendQueriesEnabled });
  const fileMap = useFileMap({ isAuthenticated: backendQueriesEnabled });

  const { data: config, isFetched: isStartupConfigFetched } = useGetStartupConfig();
  const { mutate: completeOnboardingTour } = useCompleteOnboardingTourMutation(user?.id);
  const handleCompleteOnboardingTour = useCallback(() => {
    completeOnboardingTour();
  }, [completeOnboardingTour]);
  const termsModalEnabled = config?.interface?.termsOfService?.modalAcceptance === true;
  const { data: onboardingData, isFetched: isOnboardingFetched } = useOnboardingTourStatusQuery(
    user?.id,
    {
      enabled: backendQueriesEnabled,
    },
  );
  const { data: termsData, isFetched: isTermsFetched } = useUserTermsQuery({
    enabled: backendQueriesEnabled && termsModalEnabled,
  });
  const hasUnacceptedTerms = termsModalEnabled && termsData?.termsAccepted === false;
  const isOnboardingReady =
    isStartupConfigFetched &&
    isOnboardingFetched &&
    onboardingData != null &&
    (!termsModalEnabled || (isTermsFetched && termsData != null)) &&
    onboardingStorageKey != null;

  useSearchEnabled(backendQueriesEnabled);

  useEffect(() => {
    if (termsData) {
      setShowTerms(!termsData.termsAccepted);
    }
  }, [termsData]);

  useEffect(() => {
    const root = document.documentElement;
    if (isCoworkRoute || root.dataset.routeTransition !== 'cowork-to-chat') {
      return;
    }

    const clearRouteTransition = () => {
      delete root.dataset.routeTransition;
    };
    const timeout = window.setTimeout(clearRouteTransition, 180);

    return () => window.clearTimeout(timeout);
  }, [isCoworkRoute, location.key]);

  const handleAcceptTerms = () => {
    setShowTerms(false);
  };

  const handleDeclineTerms = () => {
    setShowTerms(false);
    logout('/login?redirect=false');
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <SetConvoProvider>
      <FileMapContext.Provider value={fileMap}>
        <AssistantsMapContext.Provider value={assistantsMap}>
          <AgentsMapContext.Provider value={agentsMap}>
            <PromptGroupsProvider>
              <Banner onHeightChange={setBannerHeight} />
              <div className="flex" style={{ height: `calc(100dvh - ${bannerHeight}px)` }}>
                <div
                  className={`app-route-shell relative z-0 flex h-full w-full overflow-hidden ${
                    isCoworkRoute ? 'app-route-shell-cowork' : 'app-route-shell-chat'
                  }`}
                >
                  {!isCoworkRoute && <Nav navVisible={navVisible} setNavVisible={setNavVisible} />}
                  <div className="relative flex h-full max-w-full flex-1 flex-col overflow-hidden">
                    {!isCoworkRoute && (
                      <MobileNav navVisible={navVisible} setNavVisible={setNavVisible} />
                    )}
                    <Outlet context={{ navVisible, setNavVisible } satisfies ContextType} />
                  </div>
                </div>
                {onboardingStorageKey != null && (
                  <FirstLoginTour
                    completed={onboardingData?.completed === true}
                    disabled={showTerms || hasUnacceptedTerms || !isOnboardingReady}
                    onComplete={handleCompleteOnboardingTour}
                    storageKey={onboardingStorageKey}
                  />
                )}
              </div>
            </PromptGroupsProvider>
          </AgentsMapContext.Provider>
          {config?.interface?.termsOfService?.modalAcceptance === true && (
            <TermsAndConditionsModal
              open={showTerms}
              onOpenChange={setShowTerms}
              onAccept={handleAcceptTerms}
              onDecline={handleDeclineTerms}
              title={config.interface.termsOfService.modalTitle}
              modalContent={config.interface.termsOfService.modalContent}
            />
          )}
        </AssistantsMapContext.Provider>
      </FileMapContext.Provider>
    </SetConvoProvider>
  );
}
