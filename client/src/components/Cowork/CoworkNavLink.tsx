// cowork — left-sidebar entry that opens the dedicated Cowork section.
import { Link } from 'react-router-dom';
import { Briefcase } from 'lucide-react';

export default function CoworkNavLink({ toggleNav }: { toggleNav?: () => void }) {
  return (
    <Link
      to="/cowork"
      onClick={toggleNav}
      className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-text-primary hover:bg-surface-hover"
    >
      <Briefcase className="size-4 text-text-secondary" />
      <span>Cowork</span>
    </Link>
  );
}
