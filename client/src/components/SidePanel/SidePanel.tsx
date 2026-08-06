import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { ArrowRightToLine, X } from 'lucide-react';
import { useUserKeyQuery } from 'librechat-data-provider/react-query';
import { Button, TooltipAnchor, useMediaQuery } from '@librechat/client';
import type { TEndpointsConfig, TInterfaceConfig } from 'librechat-data-provider';
import useSideNavLinks from '~/hooks/Nav/useSideNavLinks';
import { useLocalStorage, useLocalize } from '~/hooks';
import { useGetEndpointsQuery } from '~/data-provider';
import MarketplaceAdminSettings from '~/components/Agents/MarketplaceAdminSettings';
import NavToggle from '~/components/Nav/NavToggle';
import { ACTIVE_PANEL_STORAGE_KEY, clearStoredActivePanel, useSidePanelContext } from '~/Providers';
import { cn } from '~/utils';
import Nav from './Nav';
import { OPEN_CONTROL_PANEL_EVENT } from './events';

const defaultMinSize = 20;

const SidePanel = ({
  navCollapsedSize = 3,
  minSize,
  setMinSize,
  collapsedSize,
  setCollapsedSize,
  isCollapsed,
  setIsCollapsed,
  fullCollapse,
  setFullCollapse,
}: {
  navCollapsedSize?: number;
  minSize: number;
  setMinSize: React.Dispatch<React.SetStateAction<number>>;
  collapsedSize: number;
  setCollapsedSize: React.Dispatch<React.SetStateAction<number>>;
  isCollapsed: boolean;
  setIsCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  fullCollapse: boolean;
  setFullCollapse: React.Dispatch<React.SetStateAction<boolean>>;
  interfaceConfig: TInterfaceConfig;
}) => {
  const localize = useLocalize();
  const { endpoint } = useSidePanelContext();
  const [isHovering, setIsHovering] = useState(false);
  const [newUser, setNewUser] = useLocalStorage('newUser', true);
  const { data: endpointsConfig = {} as TEndpointsConfig } = useGetEndpointsQuery();

  const isSmallScreen = useMediaQuery('(max-width: 767px)');

  const { data: keyExpiry = { expiresAt: undefined } } = useUserKeyQuery(endpoint ?? '');

  const defaultActive = useMemo(() => {
    if (isCollapsed) {
      return '';
    }

    const activePanel = localStorage.getItem(ACTIVE_PANEL_STORAGE_KEY);
    return typeof activePanel === 'string' ? activePanel : undefined;
  }, [isCollapsed]);

  const userProvidesKey = useMemo(
    () => !!(endpointsConfig?.[endpoint ?? '']?.userProvide ?? false),
    [endpointsConfig, endpoint],
  );
  const keyProvided = useMemo(
    () => (userProvidesKey ? !!(keyExpiry.expiresAt ?? '') : true),
    [keyExpiry.expiresAt, userProvidesKey],
  );

  const collapsePanel = useCallback(() => {
    clearStoredActivePanel();

    if (isSmallScreen) {
      setIsCollapsed(true);
      setCollapsedSize(0);
      setMinSize(0);
      setFullCollapse(true);
      localStorage.setItem('fullPanelCollapse', 'true');
      localStorage.setItem('react-resizable-panels:collapsed', 'true');
      return;
    }

    setIsCollapsed(true);
    setCollapsedSize(navCollapsedSize);
    setMinSize(defaultMinSize);
    setFullCollapse(false);
    localStorage.setItem('fullPanelCollapse', 'false');
    localStorage.setItem('react-resizable-panels:collapsed', 'true');
  }, [
    isSmallScreen,
    navCollapsedSize,
    setCollapsedSize,
    setFullCollapse,
    setIsCollapsed,
    setMinSize,
  ]);

  const expandPanel = useCallback(() => {
    setMinSize(defaultMinSize);
    setCollapsedSize(navCollapsedSize);
    setFullCollapse(false);
    setIsCollapsed(false);
    localStorage.setItem('fullPanelCollapse', 'false');
    localStorage.setItem('react-resizable-panels:collapsed', 'false');
  }, [navCollapsedSize, setCollapsedSize, setFullCollapse, setIsCollapsed, setMinSize]);

  const Links = useSideNavLinks({
    collapsePanel,
    endpoint,
    expandPanel,
    isCollapsed,
    isSmallScreen,
    keyProvided,
    endpointsConfig,
  });

  const toggleNavVisible = useCallback(() => {
    if (newUser) {
      setNewUser(false);
    }
    setIsCollapsed((prev: boolean) => {
      const nextIsCollapsed = !prev;
      localStorage.setItem('react-resizable-panels:collapsed', JSON.stringify(nextIsCollapsed));
      if (prev) {
        setMinSize(defaultMinSize);
        setCollapsedSize(navCollapsedSize);
        setFullCollapse(false);
        localStorage.setItem('fullPanelCollapse', 'false');
      }
      return nextIsCollapsed;
    });
  }, [
    newUser,
    setNewUser,
    setMinSize,
    setIsCollapsed,
    setFullCollapse,
    setCollapsedSize,
    navCollapsedSize,
  ]);

  const shouldHidePanel =
    (isSmallScreen && isCollapsed && (minSize === 0 || collapsedSize === 0)) || fullCollapse;
  const sidePanelLayoutState = useMemo<'expanded' | 'hidden' | 'rail'>(() => {
    if (isSmallScreen || shouldHidePanel) {
      return 'hidden';
    }

    if (isCollapsed) {
      return 'rail';
    }

    return 'expanded';
  }, [isCollapsed, isSmallScreen, shouldHidePanel]);
  const sidePanelOverlayClass = useMemo(() => {
    if (isSmallScreen) {
      return 'sidepanel-overlay-mobile';
    }

    return isCollapsed ? 'sidepanel-overlay-rail' : 'sidepanel-overlay-expanded';
  }, [isCollapsed, isSmallScreen]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleTourOpen = () => {
      if (!shouldHidePanel && !isCollapsed) {
        return;
      }

      expandPanel();
    };

    const handleTourClose = () => {
      if (shouldHidePanel || isCollapsed) {
        return;
      }

      collapsePanel();
    };
    const handleOpenControlPanel = () => {
      if (isSmallScreen) {
        return;
      }

      expandPanel();
    };

    window.addEventListener('sidepanel-tour-open', handleTourOpen as EventListener);
    window.addEventListener('sidepanel-tour-close', handleTourClose as EventListener);
    window.addEventListener(OPEN_CONTROL_PANEL_EVENT, handleOpenControlPanel);

    return () => {
      window.removeEventListener('sidepanel-tour-open', handleTourOpen as EventListener);
      window.removeEventListener('sidepanel-tour-close', handleTourClose as EventListener);
      window.removeEventListener(OPEN_CONTROL_PANEL_EVENT, handleOpenControlPanel);
    };
  }, [collapsePanel, expandPanel, isCollapsed, isSmallScreen, shouldHidePanel]);

  return (
    <div className="sidepanel-overlay-stack fixed z-[110]" data-layout-state={sidePanelLayoutState}>
      {!shouldHidePanel && (
        <div
          id="controls-nav"
          aria-label={localize('com_ui_controls')}
          data-tour-id="sidepanel-controls"
          data-tour-clip="sidepanel"
          data-tour-clip-root="sidepanel"
          data-tour-padding="-4"
          data-tour-radius="22"
          data-tour-offset-x="-2"
          role="navigation"
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
          className={cn('sidepanel-shell sidepanel-overlay hide-scrollbar', sidePanelOverlayClass)}
        >
          {!isSmallScreen && !isCollapsed && (
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 pb-3 pt-4">
              <h2 className="truncate text-xl font-semibold tracking-[-0.02em] text-text-primary">
                {localize('com_nav_control_panel')}
              </h2>
              <div className="sidepanel-desktop-header-actions">
                <TooltipAnchor
                  description={localize('com_sidepanel_collapse_help')}
                  side="left"
                  render={
                    <Button
                      variant="ghost"
                      size="icon"
                      className="sidepanel-header-collapse"
                      aria-description={localize('com_sidepanel_collapse_help')}
                      aria-label={localize('com_ui_collapse')}
                      onClick={collapsePanel}
                    >
                      <ArrowRightToLine className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  }
                />
                <MarketplaceAdminSettings
                  triggerClassName="marketplace-controlpanel-admin-trigger sidepanel-admin-trigger"
                  tourId="admin-settings"
                />
              </div>
            </div>
          )}
          {isSmallScreen && (
            <div className="sidepanel-mobile-header">
              <div className="sidepanel-mobile-header-copy">
                <p className="sidepanel-mobile-eyebrow">{localize('com_nav_control_panel')}</p>
                <h2 className="sidepanel-mobile-title">{localize('com_ui_controls')}</h2>
              </div>
              <button
                type="button"
                onClick={collapsePanel}
                aria-label={localize('com_ui_close_var', { 0: localize('com_nav_control_panel') })}
                className="sidepanel-mobile-close"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          )}
          <Nav
            defaultActive={defaultActive}
            links={Links}
            isCollapsed={isCollapsed}
            resize={expandPanel}
          />
        </div>
      )}
      {shouldHidePanel && (
        <div className="pointer-events-none absolute right-[-0.7rem] top-1/2 z-[1] -translate-y-1/2">
          <NavToggle
            navVisible={!isCollapsed}
            isHovering={isHovering}
            onToggle={toggleNavVisible}
            setIsHovering={setIsHovering}
            className="sidepanel-toggle pointer-events-auto"
            translateX={false}
            side="right"
          />
        </div>
      )}
    </div>
  );
};

export default memo(SidePanel);
