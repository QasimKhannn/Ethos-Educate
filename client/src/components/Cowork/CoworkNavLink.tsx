// cowork — left-sidebar entry that opens the dedicated Cowork section.
// Styled as a featured destination (icon tile + label + tagline), not a plain nav heading.
import { Link, useLocation } from 'react-router-dom';
import { Briefcase, ChevronRight } from 'lucide-react';
import { TooltipAnchor } from '@librechat/client';
import { useCoworkAccessQuery } from '~/data-provider';
import { useLocalize } from '~/hooks';

export default function CoworkNavLink({ toggleNav }: { toggleNav?: () => void }) {
  const localize = useLocalize();
  const location = useLocation();
  const { data: access } = useCoworkAccessQuery();
  const isCurrent = location.pathname === '/cowork' || location.pathname.startsWith('/cowork/');
  // Hide the entry for users the admin hasn't granted Cowork access (the API enforces it too).
  if (access && !access.allowed) {
    return null;
  }
  return (
    <TooltipAnchor
      description={localize('com_nav_tooltip_cowork')}
      render={
        <Link
          to="/cowork"
          onClick={toggleNav}
          aria-label="Open Cowork"
          aria-current={isCurrent ? 'page' : undefined}
          data-active={isCurrent}
          className="sidebar-cowork-link group flex items-center gap-2.5 rounded-lg border px-2.5 py-2"
        >
          <span className="sidebar-cowork-link-icon flex size-7 flex-none items-center justify-center rounded-md">
            <Briefcase className="size-4" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="sidebar-cowork-link-label text-sm font-semibold leading-tight">
              {localize('com_sidepanel_cowork_label')}
            </span>
            <span className="sidebar-cowork-link-description truncate text-xs leading-tight">
              {localize('com_sidepanel_cowork_description')}
            </span>
          </span>
          <ChevronRight className="sidebar-cowork-link-chevron size-4 flex-none" />
        </Link>
      }
    />
  );
}
