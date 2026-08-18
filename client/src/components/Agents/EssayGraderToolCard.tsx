import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLocalize } from '~/hooks';

const essayGraderIcon = '/assets/agent-icons/essay-grader.svg';

interface EssayGraderToolCardProps {
  variant: 'card' | 'storefront';
  viewMode?: 'compact' | 'large';
}

const EssayGraderToolCard: React.FC<EssayGraderToolCardProps> = ({
  variant,
  viewMode = 'large',
}) => {
  const localize = useLocalize();
  const navigate = useNavigate();
  const title = localize('com_essay_grader_title');
  const description = localize('com_essay_grader_toolkit_description');

  const openTool = () => {
    navigate('/tools/essay-grader');
  };

  if (variant === 'storefront') {
    return (
      <button
        type="button"
        className="agents-marketplace-storefront-row"
        data-view-mode={viewMode}
        aria-label={`${title}. ${description}`}
        onClick={openTool}
      >
        <div className="agents-marketplace-storefront-icon-wrap" aria-hidden="true">
          <div className="agents-marketplace-storefront-avatar bg-surface-secondary">
            <img
              src={essayGraderIcon}
              alt=""
              className="agents-marketplace-storefront-art h-full w-full object-contain"
            />
          </div>
        </div>
        <div className="agents-marketplace-storefront-copy">
          <h3 className="agents-marketplace-storefront-title">{title}</h3>
          <p className="agents-marketplace-storefront-description">{description}</p>
        </div>
      </button>
    );
  }

  return (
    <article
      className="agent-card-shell group overflow-hidden rounded-xl border"
      data-view-mode={viewMode}
    >
      <button
        type="button"
        className="agent-card-trigger w-full text-left"
        data-view-mode={viewMode}
        aria-label={`${title}. ${description}`}
        onClick={openTool}
      >
        <div className="agent-card-avatar-shell flex h-[3.95rem] w-[3.95rem] shrink-0 items-center justify-center rounded-xl border border-border-light bg-surface-secondary">
          <img
            src={essayGraderIcon}
            alt=""
            className="agent-card-art h-full w-full object-contain"
          />
        </div>
        <div className="agent-card-copy min-w-0">
          <div className="agent-card-title-row">
            <span className="agent-card-title line-clamp-3 text-base font-semibold text-text-primary md:line-clamp-2 md:text-lg">
              {title}
            </span>
          </div>
          <p className="agent-card-description mt-1 text-sm leading-6 text-text-secondary">
            {description}
          </p>
        </div>
      </button>
    </article>
  );
};

export default EssayGraderToolCard;
