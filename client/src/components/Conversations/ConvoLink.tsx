import React from 'react';
import type { TranslationKeys } from '~/hooks';
import { cn } from '~/utils';

interface ConvoLinkProps {
  isActiveConvo: boolean;
  isPopoverActive: boolean;
  title: string | null;
  onRename: () => void;
  isSmallScreen: boolean;
  localize: (key: TranslationKeys, options?: Record<string, boolean | number | string>) => string;
}

const ConvoLink: React.FC<ConvoLinkProps> = ({
  isActiveConvo,
  isPopoverActive,
  title,
  onRename,
  isSmallScreen,
  localize,
}) => {
  return (
    <div
      className={cn(
        'sidebar-convo-link flex grow items-center gap-2 overflow-hidden rounded-xl px-2.5',
        isActiveConvo || isPopoverActive ? 'sidebar-convo-link-active' : '',
      )}
      title={title ?? undefined}
      aria-current={isActiveConvo ? 'page' : undefined}
      style={{ width: '100%' }}
    >
      <div
        className="sidebar-convo-title relative flex-1 grow truncate"
        onDoubleClick={(e) => {
          if (isSmallScreen) {
            return;
          }
          e.preventDefault();
          e.stopPropagation();
          onRename();
        }}
        aria-label={title || localize('com_ui_untitled')}
      >
        {title || localize('com_ui_untitled')}
      </div>
    </div>
  );
};

export default ConvoLink;
