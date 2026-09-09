import { memo } from 'react';
import { Button, TooltipAnchor } from '@librechat/client';
import { useLocalize } from '~/hooks';

function PanelNavigation({
  onPrevious,
  onNext,
  hasNextPage,
  hasPreviousPage,
  isLoading,
  children,
}: {
  onPrevious: () => void;
  onNext: () => void;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  isLoading?: boolean;
  children?: React.ReactNode;
}) {
  const localize = useLocalize();

  return (
    <div className="flex items-center justify-between">
      <div className="flex gap-2 pl-1">{children}</div>
      <div className="flex items-center gap-2" role="navigation" aria-label="Pagination">
        <TooltipAnchor
          description={localize('com_ui_tooltip_previous_page')}
          render={
            <Button
              variant="outline"
              size="sm"
              onClick={onPrevious}
              disabled={!hasPreviousPage || isLoading}
              aria-label={localize('com_ui_tooltip_previous_page')}
            >
              {localize('com_ui_prev')}
            </Button>
          }
        />
        <TooltipAnchor
          description={localize('com_ui_tooltip_next_page')}
          render={
            <Button
              variant="outline"
              size="sm"
              onClick={onNext}
              disabled={!hasNextPage || isLoading}
              aria-label={localize('com_ui_tooltip_next_page')}
            >
              {localize('com_ui_next')}
            </Button>
          }
        />
      </div>
    </div>
  );
}

export default memo(PanelNavigation);
