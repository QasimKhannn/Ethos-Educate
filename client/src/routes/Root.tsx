import React, { useState, useEffect, useMemo } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useMediaQuery } from '@librechat/client';
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
import { useUserTermsQuery, useGetStartupConfig } from '~/data-provider';
import { Nav, MobileNav, NAV_WIDTH } from '~/components/Nav';
import FirstLoginTour from '~/components/Onboarding/FirstLoginTour';
import { TermsAndConditionsModal } from '~/components/ui';
import { useHealthCheck } from '~/data-provider';
import { Banner } from '~/components/Banners';
import { SIDEBAR_ANIMATION_MS, SIDEBAR_EASE_CSS } from '~/components/Nav/sidebarMotion';

export default function Root() {
  const [showTerms, setShowTerms] = useState(false);
  const [bannerHeight, setBannerHeight] = useState(0);
  const [navVisible, setNavVisible] = useState(() => {
    const savedNavVisible = localStorage.getItem('navVisible');
    return savedNavVisible !== null ? JSON.parse(savedNavVisible) : true;
  });

  const { user, isAuthenticated, logout } = useAuthContext();
  const backendQueriesEnabled = isAuthenticated;
  const isSmallScreen = useMediaQuery('(max-width: 768px)');
  // cowork — the dedicated Cowork section renders its own rail, so hide the chat
  // sidebar ONLY for /cowork routes. All other routes are unaffected.
  const isCoworkRoute = useLocation().pathname.startsWith('/cowork');
  const onboardingStorageKey = useMemo(() => {
    const identifier = user?.id ?? user?.email ?? user?.username;

    if (!identifier) {
      return null;
    }

    return `first-login-tour:v1:${identifier}`;
  }, [user?.email, user?.id, user?.username]);

  // Global health check - runs once per authenticated session
  useHealthCheck(backendQueriesEnabled);

  const assistantsMap = useAssistantsMap({ isAuthenticated: backendQueriesEnabled });
  const agentsMap = useAgentsMap({ isAuthenticated: backendQueriesEnabled });
  const fileMap = useFileMap({ isAuthenticated: backendQueriesEnabled });

  const { data: config } = useGetStartupConfig();
  const { data: termsData } = useUserTermsQuery({
    enabled: backendQueriesEnabled && config?.interface?.termsOfService?.modalAcceptance === true,
  });

  useSearchEnabled(backendQueriesEnabled);

  useEffect(() => {
    if (termsData) {
      setShowTerms(!termsData.termsAccepted);
    }
  }, [termsData]);

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
                <div className="relative z-0 flex h-full w-full overflow-hidden">
                  {!isCoworkRoute && <Nav navVisible={navVisible} setNavVisible={setNavVisible} />}
                  <div
                    className="relative flex h-full max-w-full flex-1 flex-col overflow-hidden"
                    style={
                      isSmallScreen
                        ? {
                            transform: navVisible
                              ? `translateX(${NAV_WIDTH.MOBILE}px)`
                              : 'translateX(0)',
                            transition: `transform ${SIDEBAR_ANIMATION_MS}ms ${SIDEBAR_EASE_CSS}`,
                            willChange: 'transform',
                          }
                        : undefined
                    }
                    {...{ inert: navVisible && isSmallScreen ? '' : undefined }}
                  >
                    {!isCoworkRoute && (
                      <MobileNav navVisible={navVisible} setNavVisible={setNavVisible} />
                    )}
                    <Outlet context={{ navVisible, setNavVisible } satisfies ContextType} />
                  </div>
                </div>
                {onboardingStorageKey != null && (
                  <FirstLoginTour disabled={showTerms} storageKey={onboardingStorageKey} />
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
