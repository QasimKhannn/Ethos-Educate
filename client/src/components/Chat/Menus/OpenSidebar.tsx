import { startTransition } from 'react';
import { PanelLeftOpen } from 'lucide-react';
import { TooltipAnchor, Button } from '@librechat/client';
import { SIDEBAR_FOCUS_DELAY_MS } from '~/components/Nav/sidebarMotion';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';
import { saveNavVisibility } from '~/components/Nav/sidebarVisibility';

/** Element ID for the close sidebar button - used for focus management */
export const CLOSE_SIDEBAR_ID = 'close-sidebar-button';
/** Element ID for the open sidebar button - used for focus management */
export const OPEN_SIDEBAR_ID = 'open-sidebar-button';

export default function OpenSidebar({
  setNavVisible,
  className,
}: {
  setNavVisible: React.Dispatch<React.SetStateAction<boolean>>;
  className?: string;
}) {
  const localize = useLocalize();

  const handleClick = () => {
    // Use startTransition to mark this as a non-urgent update
    // This prevents blocking the main thread during the cascade of re-renders
    startTransition(() => {
      setNavVisible((prev) => {
        saveNavVisibility(!prev);
        return !prev;
      });
    });
    setTimeout(() => {
      document.getElementById(CLOSE_SIDEBAR_ID)?.focus();
    }, SIDEBAR_FOCUS_DELAY_MS);
  };

  return (
    <TooltipAnchor
      description={localize('com_nav_open_sidebar')}
      render={
        <Button
          id={OPEN_SIDEBAR_ID}
          size="icon"
          variant="outline"
          data-testid="open-sidebar-button"
          aria-label={localize('com_nav_open_sidebar')}
          aria-expanded={false}
          aria-controls="chat-history-nav"
          className={cn(
            'rounded-xl bg-presentation duration-0 hover:bg-surface-active-alt',
            className,
          )}
          onClick={handleClick}
        >
          <PanelLeftOpen aria-hidden="true" className="sidebar-nav-toggle-icon" />
        </Button>
      }
    />
  );
}
