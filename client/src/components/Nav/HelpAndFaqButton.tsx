import { MessageCircleQuestion } from 'lucide-react';
import { Button, TooltipAnchor } from '@librechat/client';
import { useLocalize } from '~/hooks';

const FEEDBACK_URL = 'https://feedback.ethosintelligence.ai/';

interface HelpAndFaqButtonProps {
  className?: string;
  compact?: boolean;
}

export default function HelpAndFaqButton({ className, compact = false }: HelpAndFaqButtonProps) {
  const localize = useLocalize();

  if (compact) {
    return (
      <TooltipAnchor
        description={localize('com_nav_tooltip_help_faq')}
        side="right"
        render={
          <Button asChild size="icon" variant="ghost" className={className}>
            <a
              href={FEEDBACK_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={localize('com_nav_help_faq')}
            >
              <MessageCircleQuestion className="h-5 w-5" aria-hidden="true" />
            </a>
          </Button>
        }
      />
    );
  }

  return (
    <a
      href={FEEDBACK_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="sidebar-help-item sidebar-utility-item mt-1.5 flex min-h-11 w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-sm text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black dark:focus-visible:ring-white"
    >
      <span className="sidebar-utility-icon flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl">
        <MessageCircleQuestion className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="truncate text-[0.95rem] font-medium tracking-[-0.014em]">
        {localize('com_nav_help_faq')}
      </span>
    </a>
  );
}
