// cowork — left-sidebar entry that opens the dedicated Cowork section.
// Styled as a featured destination (icon tile + label + tagline), not a plain nav heading.
import { Link } from 'react-router-dom';
import { Briefcase, ChevronRight } from 'lucide-react';
import { useCoworkAccessQuery } from '~/data-provider';

export default function CoworkNavLink({ toggleNav }: { toggleNav?: () => void }) {
  const { data: access } = useCoworkAccessQuery();
  // Hide the entry for users the admin hasn't granted Cowork access (the API enforces it too).
  if (access && !access.allowed) {
    return null;
  }
  return (
    <Link
      to="/cowork"
      onClick={toggleNav}
      aria-label="Open Cowork"
      className="group flex items-center gap-2.5 rounded-lg border border-border-medium bg-surface-secondary px-2.5 py-2 transition-colors hover:bg-surface-tertiary"
    >
      <span className="flex size-7 flex-none items-center justify-center rounded-md bg-blue-500/10 text-blue-500">
        <Briefcase className="size-4" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-semibold leading-tight text-text-primary">Cowork</span>
        <span className="truncate text-xs leading-tight text-text-tertiary">
          Automations &amp; workspace
        </span>
      </span>
      <ChevronRight className="size-4 flex-none text-text-tertiary transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
