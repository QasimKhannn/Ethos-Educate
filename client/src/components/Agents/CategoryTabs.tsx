import React, { useCallback, useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { useReducedMotion } from 'framer-motion';
import { useMediaQuery } from '@librechat/client';
import type t from 'librechat-data-provider';
import { useLocalize } from '~/hooks';
import { getFriendlyAgentCategoryLabel } from '~/hooks/Agents/useAgentCategories';
import { SmartLoader } from './SmartLoader';
import { cn } from '~/utils';

/**
 * Props for the CategoryTabs component
 */
interface CategoryTabsProps {
  /** Array of agent categories to display as tabs */
  categories: t.TMarketplaceCategory[];
  /** Currently selected tab value */
  activeTab: string;
  /** Whether categories are currently loading */
  isLoading: boolean;
  /** Callback fired when a tab is selected */
  onChange: (value: string) => void;
}

/**
 * CategoryTabs - Component for displaying category tabs with counts
 *
 * Renders a tabbed navigation interface showing agent categories.
 * Includes loading states, empty state handling, and displays counts for each category.
 * Uses database-driven category labels with no hardcoded values.
 * Features multi-row wrapping for better responsive behavior.
 */
const CategoryTabs: React.FC<CategoryTabsProps> = ({
  categories,
  activeTab,
  isLoading,
  onChange,
}) => {
  const localize = useLocalize();
  const isSmallScreen = useMediaQuery('(max-width: 767px)');
  const shouldReduceMotion = useReducedMotion();
  const tabListRef = useRef<HTMLDivElement>(null);
  const activeIndicatorRef = useRef<HTMLSpanElement>(null);
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());
  const animationFrameRef = useRef<number | null>(null);

  const setTabRef = useCallback(
    (value: string) => (node: HTMLButtonElement | null) => {
      if (node) {
        tabRefs.current.set(value, node);
        return;
      }

      tabRefs.current.delete(value);
    },
    [],
  );

  const syncActiveIndicator = useCallback(() => {
    const tabList = tabListRef.current;
    const indicator = activeIndicatorRef.current;
    const activeTabElement = tabRefs.current.get(activeTab);

    if (!tabList || !indicator || !activeTabElement) {
      return;
    }

    if (typeof activeTabElement.scrollIntoView === 'function') {
      activeTabElement.scrollIntoView({
        block: 'nearest',
        inline: 'nearest',
        behavior: shouldReduceMotion ? 'auto' : 'smooth',
      });
    }

    const nextPosition = {
      height: activeTabElement.offsetHeight,
      width: activeTabElement.offsetWidth,
      x: activeTabElement.offsetLeft,
      y: activeTabElement.offsetTop,
    };

    if (shouldReduceMotion) {
      gsap.set(indicator, { ...nextPosition, autoAlpha: 1 });
      return;
    }

    gsap.to(indicator, {
      ...nextPosition,
      autoAlpha: 1,
      duration: 0.24,
      ease: 'power2.out',
      overwrite: true,
    });
  }, [activeTab, shouldReduceMotion]);

  const queueIndicatorSync = useCallback(() => {
    if (animationFrameRef.current != null) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    animationFrameRef.current = requestAnimationFrame(() => {
      animationFrameRef.current = null;
      syncActiveIndicator();
    });
  }, [syncActiveIndicator]);

  useEffect(() => {
    queueIndicatorSync();

    return () => {
      if (animationFrameRef.current == null) {
        return;
      }

      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    };
  }, [categories, isSmallScreen, queueIndicatorSync]);

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const tabList = tabListRef.current;
    const activeTabElement = tabRefs.current.get(activeTab);

    if (!tabList || !activeTabElement) {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      queueIndicatorSync();
    });

    resizeObserver.observe(tabList);
    resizeObserver.observe(activeTabElement);

    return () => {
      resizeObserver.disconnect();
    };
  }, [activeTab, categories, queueIndicatorSync]);

  /** Helper function to get category display name from database data */
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

  // Handle keyboard navigation between tabs
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
      case 'ArrowUp':
        e.preventDefault();
        // Move up a row (approximate by moving back ~4-6 items)
        newIndex = Math.max(0, currentIndex - 5);
        break;
      case 'ArrowDown':
        e.preventDefault();
        // Move down a row (approximate by moving forward ~4-6 items)
        newIndex = Math.min(categories.length - 1, currentIndex + 5);
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
      // Focus the new tab
      setTimeout(() => {
        const newTab = document.getElementById(`category-tab-${newCategory.value}`);
        if (newTab) {
          newTab.focus();
        }
      }, 0);
    }
  };

  // Early return if no categories available
  if (!isLoading && (!categories || categories.length === 0)) {
    return (
      <div className="text-center text-text-secondary">{localize('com_ui_no_categories')}</div>
    );
  }

  // Main tabs content
  const tabsContent = (
    <div
      className="w-full"
      data-tour-id="marketplace-categories"
      data-tour-padding="0"
      data-tour-radius="20"
    >
      <div
        ref={tabListRef}
        className={cn(
          'agents-marketplace-category-tablist relative w-full',
          isSmallScreen
            ? 'scrollbar-hide flex snap-x snap-mandatory scroll-px-1 gap-2 overflow-x-auto scroll-smooth pb-1'
            : 'flex w-full flex-wrap items-start justify-start gap-1.5 overflow-visible pb-1',
        )}
        role="tablist"
        aria-label={localize('com_agents_category_tabs_label')}
        aria-orientation="horizontal"
        style={
          isSmallScreen
            ? {
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                WebkitOverflowScrolling: 'touch',
              }
            : {
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
              }
        }
      >
        <span
          ref={activeIndicatorRef}
          className="agents-marketplace-category-active-glide"
          aria-hidden="true"
        />
        {categories.map((category, index) => {
          const categoryLabel = getCategoryDisplayName(category);
          const shouldShowCount = category.count > 0;

          return (
            <button
              ref={setTabRef(category.value)}
              key={category.value}
              id={`category-tab-${category.value}`}
              onClick={() => onChange(category.value)}
              onKeyDown={(e) => handleKeyDown(e, category.value)}
              className={cn(
                'agents-marketplace-category-tab flex min-h-10 items-center rounded-lg border px-3.5 py-2 text-sm font-medium transition-[background-color,border-color,color] duration-150',
                isSmallScreen
                  ? 'min-w-fit shrink-0 snap-start whitespace-nowrap'
                  : 'shrink-0 whitespace-nowrap',
                activeTab === category.value
                  ? 'agents-marketplace-category-tab-active border-transparent bg-transparent text-text-primary'
                  : 'border-transparent bg-transparent text-text-secondary hover:border-transparent hover:bg-surface-hover hover:text-text-primary',
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
  );

  // Use SmartLoader to prevent category loading flashes
  return (
    <SmartLoader
      isLoading={isLoading}
      hasData={categories?.length > 0}
      delay={100} // Very short delay since categories should load quickly
      loadingComponent={loadingSkeleton}
    >
      {tabsContent}
    </SmartLoader>
  );
};

export default CategoryTabs;
