import React, { useCallback } from 'react';
import { PanelRightOpen } from 'lucide-react';
import { Button } from '@librechat/client';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';

interface MarketplaceControlPanelProps {
  className?: string;
}

const MarketplaceControlPanel = ({ className = '' }: MarketplaceControlPanelProps) => {
  const localize = useLocalize();

  const openSharedSidePanel = useCallback(() => {
    window.dispatchEvent(new CustomEvent('sidepanel-tour-open'));
  }, []);

  return (
    <Button
      type="button"
      variant="outline"
      aria-label={localize('com_nav_control_panel')}
      data-tour-id="sidepanel-controls"
      data-tour-padding="-2"
      data-tour-radius="18"
      onClick={openSharedSidePanel}
      className={cn('agents-marketplace-panel-trigger', className)}
    >
      <PanelRightOpen className="h-4 w-4" aria-hidden="true" />
      <span>{localize('com_nav_control_panel')}</span>
    </Button>
  );
};

export default MarketplaceControlPanel;
