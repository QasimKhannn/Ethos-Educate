import { LoaderCircle } from 'lucide-react';
import { useLocalize } from '~/hooks';
import type { IntakeTemplate } from './agentIntake';

const preparationKeys: Record<IntakeTemplate, string> = {
  worksheet: 'com_agents_intake_preparing_worksheet',
  assessment: 'com_agents_intake_preparing_assessment',
  presentation: 'com_agents_intake_preparing_presentation',
};

export default function AgentIntakeHandoff({ template }: { template: IntakeTemplate | null }) {
  const localize = useLocalize();
  const message = template
    ? localize(preparationKeys[template])
    : localize('com_agents_intake_preparing');

  return (
    <div
      className="flex min-h-40 flex-col items-center justify-center gap-3 px-6 text-center"
      aria-live="polite"
      role="status"
    >
      <LoaderCircle className="h-6 w-6 animate-spin text-text-secondary" aria-hidden="true" />
      <p className="text-sm font-medium text-text-primary">{message}</p>
    </div>
  );
}
