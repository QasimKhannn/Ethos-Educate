import { memo } from 'react';

import { useLocalize } from '~/hooks';

const EmptyTextPart = memo(() => {
  const localize = useLocalize();

  return (
    <div
      className="text-message flex min-h-[20px] items-center overflow-visible"
      aria-label={localize('com_ui_thinking_status')}
      aria-live="polite"
      role="status"
    >
      <span className="response-waiting-dot submitting relative h-3 w-3" aria-hidden="true">
        <span className="result-thinking" />
      </span>
    </div>
  );
});

export default EmptyTextPart;
