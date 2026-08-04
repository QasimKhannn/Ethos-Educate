import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { PanelRightOpen, X } from 'lucide-react';
import { useUserKeyQuery } from 'librechat-data-provider/react-query';
import { Button, useMediaQuery } from '@librechat/client';
import { getConfigDefaults, SystemRoles } from 'librechat-data-provider';
import type { TEndpointsConfig, TInterfaceConfig } from 'librechat-data-provider';
import { useGetEndpointsQuery, useGetStartupConfig } from '~/data-provider';
import { useSidePanelContext } from '~/Providers';
import { useAuthContext, useLocalize } from '~/hooks';
import useSideNavLinks from '~/hooks/Nav/useSideNavLinks';
import { cn } from '~/utils';
import { requestOpenControlPanel } from '~/components/SidePanel/events';
import ControlPanelTour from './ControlPanelTour';
import MarketplaceAdminSettings from './MarketplaceAdminSettings';
import Nav from '~/components/SidePanel/Nav';

interface MarketplaceControlPanelProps {
  className?: string;
  isOpen?: boolean;
}

const defaultInterface = getConfigDefaults().interface;

const MarketplaceControlPanel = ({
  className = '',
  isOpen = false,
}: MarketplaceControlPanelProps) => {
  const localize = useLocalize();
  const { user } = useAuthContext();
  const { endpoint } = useSidePanelContext();
  const { data: startupConfig } = useGetStartupConfig();
  const { data: endpointsConfig = {} as TEndpointsConfig } = useGetEndpointsQuery();
  const { data: keyExpiry = { expiresAt: undefined } } = useUserKeyQuery(endpoint ?? '');
  const isSmallScreen = useMediaQuery('(max-width: 767px)');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [isTourMode, setIsTourMode] = useState(false);
  const [isControlPanelTourActive, setIsControlPanelTourActive] = useState(false);

  const interfaceConfig = useMemo<Partial<TInterfaceConfig>>(
    () => startupConfig?.interface ?? defaultInterface,
    [startupConfig],
  );
  const userProvidesKey = useMemo(
    () => !!(endpointsConfig?.[endpoint ?? '']?.userProvide ?? false),
    [endpointsConfig, endpoint],
  );
  const keyProvided = useMemo(
    () => (userProvidesKey ? !!(keyExpiry.expiresAt ?? '') : true),
    [keyExpiry.expiresAt, userProvidesKey],
  );

  const closePanel = useCallback(() => {
    setIsTourMode(false);
    setIsControlPanelTourActive(false);
    setOpen(false);
  }, []);
  const openPanel = useCallback(() => {
    setIsTourMode(false);
    setIsControlPanelTourActive(false);

    if (isSmallScreen) {
      setOpen(true);
      return;
    }

    requestOpenControlPanel();
  }, [isSmallScreen]);
  const openPanelForTour = useCallback(() => {
    if (!isSmallScreen) {
      return;
    }

    setIsTourMode(true);
    setIsControlPanelTourActive(false);
    setOpen(true);
  }, [isSmallScreen]);
  const finishControlPanelTour = useCallback(() => {
    setIsControlPanelTourActive(false);
  }, []);

  useEffect(() => {
    if (!isSmallScreen) {
      return;
    }

    window.addEventListener('sidepanel-tour-open', openPanelForTour);
    window.addEventListener('sidepanel-tour-close', closePanel);

    return () => {
      window.removeEventListener('sidepanel-tour-open', openPanelForTour);
      window.removeEventListener('sidepanel-tour-close', closePanel);
    };
  }, [closePanel, isSmallScreen, openPanelForTour]);

  const sideNavLinks = useSideNavLinks({
    collapsePanel: closePanel,
    expandPanel: openPanel,
    isCollapsed: false,
    isSmallScreen,
    keyProvided,
    endpoint,
    endpointsConfig,
  });

  const links = useMemo(
    () => sideNavLinks.filter((link) => link.id !== 'hide-panel'),
    [sideNavLinks],
  );
  const isAdmin = user?.role === SystemRoles.ADMIN;

  if (interfaceConfig.sidePanel !== true || (links.length === 0 && !isAdmin)) {
    return null;
  }

  if (!isSmallScreen) {
    return (
      <Button
        type="button"
        variant="outline"
        aria-controls="controls-nav"
        aria-expanded={isOpen}
        data-tour-id="sidepanel-controls"
        data-tour-padding="-2"
        data-tour-radius="18"
        className={cn('agents-marketplace-panel-trigger', className)}
        onClick={openPanel}
      >
        <PanelRightOpen className="h-4 w-4" aria-hidden="true" />
        <span>{localize('com_nav_control_panel')}</span>
      </Button>
    );
  }

  return (
    <DialogPrimitive.Root
      open={open}
      modal={!isTourMode}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);

        if (!nextOpen) {
          setIsTourMode(false);
          setIsControlPanelTourActive(false);
        }
      }}
    >
      <DialogPrimitive.Trigger asChild>
        <Button
          ref={triggerRef}
          type="button"
          variant="outline"
          aria-haspopup="dialog"
          aria-expanded={open}
          data-tour-id="sidepanel-controls"
          data-tour-padding="-2"
          data-tour-radius="18"
          className={cn('agents-marketplace-panel-trigger', className)}
        >
          <PanelRightOpen className="h-4 w-4" aria-hidden="true" />
          <span>{localize('com_nav_control_panel')}</span>
        </Button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            'marketplace-controlpanel-backdrop',
            isTourMode && 'marketplace-controlpanel-backdrop--tour',
          )}
        />
        <DialogPrimitive.Content
          id="marketplace-control-panel"
          aria-describedby={undefined}
          data-control-panel-tour-root="true"
          className="marketplace-controlpanel-surface"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            triggerRef.current?.focus();
          }}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            closeRef.current?.focus();
          }}
        >
          <div className="marketplace-controlpanel-header">
            <div className="marketplace-controlpanel-heading">
              <DialogPrimitive.Title className="marketplace-controlpanel-title">
                {localize('com_nav_control_panel')}
              </DialogPrimitive.Title>
            </div>
            <div className="marketplace-controlpanel-header-actions">
              <span
                className="marketplace-controlpanel-tour-anchor"
                data-control-panel-tour-id="admin-settings"
              >
                <MarketplaceAdminSettings
                  triggerClassName="marketplace-controlpanel-admin-trigger"
                  tourId="admin-settings"
                />
              </span>
              <Button
                ref={closeRef}
                type="button"
                variant="ghost"
                onClick={closePanel}
                className="marketplace-controlpanel-close"
                data-control-panel-tour-id="close"
                aria-label={localize('com_ui_close_var', {
                  0: localize('com_nav_control_panel'),
                })}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
          <div className="marketplace-controlpanel-body">
            <div
              className="marketplace-controlpanel-nav-scope"
              data-tour-id="sidepanel-sections"
              data-tour-padding="-4"
              data-tour-radius="18"
            >
              <Nav defaultActive="" links={links} isCollapsed={false} resize={() => undefined} />
            </div>
          </div>
          <ControlPanelTour
            active={open && isControlPanelTourActive && !isTourMode}
            links={links}
            onFinish={finishControlPanelTour}
          />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

export default MarketplaceControlPanel;
