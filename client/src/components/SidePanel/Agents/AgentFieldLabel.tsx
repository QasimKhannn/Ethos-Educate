import { CircleHelpIcon, TooltipAnchor } from '@librechat/client';
import { cn } from '~/utils';

type AgentFieldLabelProps = {
  className?: string;
  description: string;
  htmlFor?: string;
  label: string;
  required?: boolean;
};

export default function AgentFieldLabel({
  className,
  description,
  htmlFor,
  label,
  required = false,
}: AgentFieldLabelProps) {
  const helpButton = (
    <button
      type="button"
      className="agent-builder-help-button"
      title={description}
      aria-label={`${label}: ${description}`}
    >
      <CircleHelpIcon aria-hidden="true" />
    </button>
  );

  return (
    <div className={cn('agent-builder-field-label', className)}>
      <label htmlFor={htmlFor}>
        {label}
        {required && <span className="text-red-500">*</span>}
      </label>
      <TooltipAnchor description={description} render={helpButton} />
    </div>
  );
}
