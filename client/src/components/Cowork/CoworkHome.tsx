// cowork — Cowork landing (no project selected). The rail handles list/create.
import { Briefcase } from 'lucide-react';

export default function CoworkHome() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-6 text-center">
      <Briefcase className="size-8 text-text-secondary" />
      <p className="text-base text-text-primary">Pick a project to open its workspace</p>
      <p className="max-w-sm text-sm text-text-secondary">
        Or create a new project from the sidebar, then delegate multi-step work to the Cowork agent.
      </p>
    </div>
  );
}
