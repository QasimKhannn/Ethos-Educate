import { RefreshCw } from 'lucide-react';
import { useLocalize } from '~/hooks';

const IncompleteImageGeneration = () => {
  const localize = useLocalize();

  return (
    <div
      role="status"
      className="not-prose my-3 flex w-full max-w-md items-start gap-2 rounded-lg border border-border-light bg-surface-secondary px-3 py-2.5 text-sm leading-5"
    >
      <RefreshCw className="mt-0.5 size-4 shrink-0 text-text-secondary" aria-hidden="true" />
      <span className="min-w-0 text-text-secondary">
        {localize('com_ui_generated_image_not_created_description')}
      </span>
    </div>
  );
};

export default IncompleteImageGeneration;
