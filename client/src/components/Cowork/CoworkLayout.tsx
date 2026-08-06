// cowork — dedicated layout for the Cowork section: persistent rail + outlet.
// Sits outside the regular chat shell so Cowork is its own self-contained space.
// On small screens the rail collapses into a slide-in drawer opened from a top bar.
import { useEffect, useRef, useState } from 'react';
import { Outlet, Navigate, useNavigate } from 'react-router-dom';
import { Menu, Briefcase } from 'lucide-react';
import { useAuthContext, useLocalize } from '~/hooks';
import { useCoworkAccessQuery } from '~/data-provider';
import CoworkSidebar from './CoworkSidebar';
import CoworkTour from './CoworkTour';

export default function CoworkLayout() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthContext();
  const localize = useLocalize();
  const { data: access } = useCoworkAccessQuery({ enabled: isAuthenticated });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isLeavingForChat, setIsLeavingForChat] = useState(false);
  const chatNavigationTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (chatNavigationTimerRef.current !== null) {
        window.clearTimeout(chatNavigationTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const openMobileProjectCreator = () => {
      if (window.matchMedia('(max-width: 767px)').matches) {
        setMobileNavOpen(true);
      }
    };

    window.addEventListener('cowork-new-project', openMobileProjectCreator);
    return () => window.removeEventListener('cowork-new-project', openMobileProjectCreator);
  }, []);

  const navigateToChat = () => {
    if (isLeavingForChat) {
      return;
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      navigate('/c/new');
      return;
    }

    setIsLeavingForChat(true);
    chatNavigationTimerRef.current = window.setTimeout(() => {
      document.documentElement.dataset.routeTransition = 'cowork-to-chat';
      navigate('/c/new');
    }, 120);
  };

  if (!isAuthenticated) {
    return null;
  }

  // Admin-managed access: send users without Cowork access back to chat (the API enforces it too).
  if (access && !access.allowed) {
    return <Navigate to="/c/new" replace={true} />;
  }

  return (
    <div
      className="cowork-refined-shell flex h-full w-full overflow-hidden bg-surface-primary"
      data-transitioning-to-chat={isLeavingForChat || undefined}
    >
      <CoworkSidebar
        mobileOpen={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        onBackToChat={navigateToChat}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar — opens the sidebar drawer (hidden on md+ where the rail is persistent). */}
        <div className="flex items-center gap-2 border-b border-border-medium px-3 py-2 md:hidden">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            aria-label={localize('com_cowork_open_menu')}
            className="rounded-md p-1.5 text-text-secondary hover:bg-surface-secondary hover:text-text-primary"
          >
            <Menu className="size-5" />
          </button>
          <Briefcase className="size-4 text-text-secondary" />
          <span className="text-sm font-semibold text-text-primary">
            {localize('com_cowork_label')}
          </span>
        </div>
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <Outlet />
        </main>
      </div>
      {/* cowork — onboarding tour (Cowork-only; renders via a portal, gated on access above) */}
      <CoworkTour />
    </div>
  );
}
