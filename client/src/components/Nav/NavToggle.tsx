import { TooltipAnchor } from '@librechat/client';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';

export default function NavToggle({
  onToggle,
  navVisible,
  isHovering,
  setIsHovering,
  side = 'left',
  className = '',
  translateX = true,
}: {
  onToggle: () => void;
  navVisible: boolean;
  isHovering: boolean;
  setIsHovering: (isHovering: boolean) => void;
  side?: 'left' | 'right';
  className?: string;
  translateX?: boolean;
}) {
  const localize = useLocalize();
  const transition = {
    transition: 'transform 0.3s ease, opacity 0.2s ease',
  };

  const rotationDegree = 18;
  const rotation = isHovering || !navVisible ? `${rotationDegree}deg` : '0deg';
  const topBarRotation = side === 'right' ? `-${rotation}` : rotation;
  const bottomBarRotation = side === 'right' ? rotation : `-${rotation}`;

  let sidebarLabel;
  let actionKey;

  if (side === 'left') {
    sidebarLabel = localize('com_ui_chat_history');
  } else {
    sidebarLabel = localize('com_nav_control_panel');
  }

  if (navVisible) {
    actionKey = 'com_ui_close_var';
  } else {
    actionKey = 'com_ui_open_var';
  }

  const ariaDescription = localize(actionKey, { 0: sidebarLabel });

  return (
    <div
      className={cn(
        className,
        '-translate-y-1/2 transition-transform',
        navVisible ? 'rotate-0' : 'rotate-180',
        navVisible && translateX ? 'translate-x-[260px]' : 'translate-x-0',
      )}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <TooltipAnchor
        side={side === 'right' ? 'left' : 'right'}
        description={ariaDescription}
        render={
          <button
            type="button"
            aria-label={ariaDescription}
            aria-expanded={navVisible}
            aria-controls={side === 'left' ? 'chat-history-nav' : 'controls-nav'}
            id={`toggle-${side}-nav`}
            onClick={onToggle}
            className="sidepanel-toggle-anchor sidepanel-toggle-control flex h-9 w-5 items-center justify-center"
            onFocus={() => setIsHovering(true)}
            onBlur={() => setIsHovering(false)}
          >
            <div
              className="flex h-5 w-3.5 flex-col items-center justify-center gap-[2px]"
              style={{ ...transition, opacity: isHovering ? 1 : 0.72 }}
            >
              {/* Top bar */}
              <div
                className="sidepanel-toggle-bar h-2.5 w-[2px] rounded-full"
                style={{
                  ...transition,
                  transform: `translateY(0.15rem) rotate(${topBarRotation}) translateZ(0px)`,
                }}
              />
              {/* Bottom bar */}
              <div
                className="sidepanel-toggle-bar h-2.5 w-[2px] rounded-full"
                style={{
                  ...transition,
                  transform: `translateY(-0.15rem) rotate(${bottomBarRotation}) translateZ(0px)`,
                }}
              />
            </div>
          </button>
        }
      />
    </div>
  );
}
