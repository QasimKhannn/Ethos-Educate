import React from 'react';
import type t from 'librechat-data-provider';
import { useLocalize } from '~/hooks';
import { getFriendlyAgentCategoryLabel } from '~/hooks/Agents/useAgentCategories';
import { SmartLoader } from './SmartLoader';
import { cn } from '~/utils';

interface CategoryTabsProps {
  categories: t.TMarketplaceCategory[];
  activeTab: string;
  isLoading: boolean;
  onChange: (value: string) => void;
}

const CategoryTabs: React.FC<CategoryTabsProps> = ({
  categories,
  activeTab,
  isLoading,
  onChange,
}) => {
  const localize = useLocalize();

  const getCategoryDisplayName = (category: t.TCategory) => {
    return getFriendlyAgentCategoryLabel({
      value: category.value,
      label: category.label,
      localize,
    });
  };

  const loadingSkeleton = (
    <div
      className="w-full"
      data-tour-id="marketplace-categories"
      data-tour-padding="0"
      data-tour-radius="20"
    >
      <div className="flex flex-wrap gap-2" aria-hidden="true">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="agents-marketplace-category-skeleton" />
        ))}
      </div>
    </div>
  );

  const handleKeyDown = (e: React.KeyboardEvent, currentCategory: string) => {
    const currentIndex = categories.findIndex((cat) => cat.value === currentCategory);
    let newIndex = currentIndex;

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        newIndex = currentIndex > 0 ? currentIndex - 1 : categories.length - 1;
        break;
      case 'ArrowRight':
        e.preventDefault();
        newIndex = currentIndex < categories.length - 1 ? currentIndex + 1 : 0;
        break;
      case 'Home':
        e.preventDefault();
        newIndex = 0;
        break;
      case 'End':
        e.preventDefault();
        newIndex = categories.length - 1;
        break;
      default:
        return;
    }

    const newCategory = categories[newIndex];
    if (newCategory) {
      onChange(newCategory.value);
      setTimeout(() => {
        const newTab = document.getElementById(`category-tab-${newCategory.value}`);
        if (newTab instanceof HTMLButtonElement) {
          newTab.focus();
        }
      }, 0);
    }
  };

  if (!isLoading && (!categories || categories.length === 0)) {
    return (
      <div className="text-center text-text-secondary">{localize('com_ui_no_categories')}</div>
    );
  }

  const tabsContent = (
    <div
      className="w-full"
      data-tour-id="marketplace-categories"
      data-tour-padding="0"
      data-tour-radius="20"
    >
      <div className="agents-marketplace-category-strip">
        <span className="agents-marketplace-category-heading" aria-hidden="true">
          {localize('com_agents_category_tabs_label')}
        </span>
        <div
          className="agents-marketplace-category-tablist scrollbar-hide flex min-w-0 flex-1 items-center gap-1 overflow-x-auto"
          role="tablist"
          aria-label={localize('com_agents_category_tabs_label')}
          aria-orientation="horizontal"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {categories.map((category, index) => {
            const categoryLabel = getCategoryDisplayName(category);
            const shouldShowCount = category.count > 0;

            return (
              <button
                key={category.value}
                id={`category-tab-${category.value}`}
                onClick={() => onChange(category.value)}
                onKeyDown={(e) => handleKeyDown(e, category.value)}
                className={cn(
                  'agents-marketplace-category-tab flex min-h-10 shrink-0 items-center border-b-2 px-2.5 py-2 text-sm font-medium transition-[border-color,color] duration-150',
                  activeTab === category.value
                    ? 'agents-marketplace-category-tab-active text-text-primary'
                    : 'border-transparent text-text-secondary hover:text-text-primary',
                )}
                role="tab"
                aria-selected={activeTab === category.value}
                aria-controls={`tabpanel-${category.value}`}
                tabIndex={activeTab === category.value ? 0 : -1}
                aria-label={localize('com_agents_category_tab_label', {
                  category: categoryLabel,
                  count: category.count,
                  position: index + 1,
                  total: categories.length,
                })}
              >
                <span className="agents-marketplace-category-label">{categoryLabel}</span>
                {shouldShowCount ? (
                  <span className="agents-marketplace-category-count" aria-hidden="true">
                    {category.count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <SmartLoader
      isLoading={isLoading}
      hasData={categories?.length > 0}
      delay={100}
      loadingComponent={loadingSkeleton}
    >
      {tabsContent}
    </SmartLoader>
  );
};

export default CategoryTabs;
