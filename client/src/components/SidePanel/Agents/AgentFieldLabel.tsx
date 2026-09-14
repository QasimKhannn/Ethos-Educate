import { cn } from '~/utils';
import { useLocalize } from '~/hooks';

type AgentFieldLabelProps = {
  className?: string;
  description: string;
  htmlFor?: string;
  label: string;
  optional?: boolean;
  required?: boolean;
};

export default function AgentFieldLabel({
  className,
  description,
  htmlFor,
  label,
  optional = false,
  required = false,
}: AgentFieldLabelProps) {
  const localize = useLocalize();

  return (
    <div className={cn('agent-builder-field-label', className)}>
      <div className="agent-builder-field-label-row">
        <label htmlFor={htmlFor}>
          {label}
          {required && <span className="text-red-500">*</span>}
        </label>
        {(required || optional) && (
          <span
            className={cn(
              'agent-builder-field-status',
              required
                ? 'agent-builder-field-status-required'
                : 'agent-builder-field-status-optional',
            )}
          >
            {localize(
              required
                ? 'com_ui_agent_builder_required_status'
                : 'com_ui_agent_builder_optional_status',
            )}
          </span>
        )}
      </div>
      <p>{description}</p>
    </div>
  );
}
