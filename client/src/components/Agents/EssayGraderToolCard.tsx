import React, { useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { loadEssayGraderRoute } from '~/components/EssayGrader/loadEssayGraderRoute';
import { useLocalize } from '~/hooks';
import { getShortStorefrontDescription } from './storefrontDescription';

const essayGraderIcon = '/assets/agent-icons/essay-grader.svg';

interface EssayGraderToolCardProps {
  variant: 'card' | 'storefront';
  viewMode?: 'compact' | 'large';
  viewVariant?: 'gallery' | 'box' | 'spotlight';
}

const EssayGraderToolCard: React.FC<EssayGraderToolCardProps> = ({
  variant,
  viewMode = 'large',
  viewVariant = 'gallery',
}) => {
  const localize = useLocalize();
  const navigate = useNavigate();
  const [isOpening, setIsOpening] = useState(false);
  const title = localize('com_essay_grader_title');
  const description = localize('com_essay_grader_toolkit_description');
  const storefrontDescription = getShortStorefrontDescription(title, description);

  const preloadTool = () => {
    void loadEssayGraderRoute();
  };

  const openTool = () => {
    if (isOpening) {
      return;
    }

    setIsOpening(true);
    void loadEssayGraderRoute()
      .then(() => navigate('/tools/essay-grader'))
      .catch(() => navigate('/tools/essay-grader'));
  };

  if (variant === 'storefront') {
    return (
      <button
        type="button"
        className="agents-marketplace-storefront-row agents-marketplace-storefront-row--directory"
        data-view-mode={viewMode}
        data-view-variant={viewVariant}
        aria-label={`${title}. ${description}`}
        aria-busy={isOpening}
        disabled={isOpening}
        onFocus={preloadTool}
        onMouseEnter={preloadTool}
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
          <div className="agents-marketplace-storefront-heading">
            <h3 className="agents-marketplace-storefront-title">{title}</h3>
          </div>
          <p className="agents-marketplace-storefront-description">{storefrontDescription}</p>
        </div>
        <ArrowUpRight
          aria-hidden="true"
          className="agents-marketplace-storefront-directory-arrow"
          size={18}
          strokeWidth={1.8}
        />
      </button>
    );
  }

  return (
    <article
      className="agent-card-shell group overflow-hidden rounded-xl border"
      data-view-mode={viewMode}
      data-view-variant={viewVariant}
    >
      <button
        type="button"
        className="agent-card-trigger w-full text-left"
        data-view-mode={viewMode}
        data-view-variant={viewVariant}
        aria-label={`${title}. ${description}`}
        aria-busy={isOpening}
        disabled={isOpening}
        onFocus={preloadTool}
        onMouseEnter={preloadTool}
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
