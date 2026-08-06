import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { gsap } from 'gsap';
import { ChevronRight, RotateCw, Search, X } from 'lucide-react';
import { useMediaQuery } from '@librechat/client';
import { PermissionBits } from 'librechat-data-provider';
import type t from 'librechat-data-provider';
import { useMarketplaceAgentsInfiniteQuery } from '~/data-provider/Agents';
import { TranslationKeys, useAgentCategories, useLocalize } from '~/hooks';
import {
  marketplaceCardRevealVariants,
  marketplaceCardStackVariants,
  marketplaceSurfaceRevealVariants,
  softRevealVariants,
} from '~/utils/motion';
import { renderAgentAvatar, getAgentDisplayName } from '~/utils';
import { useHasData } from './SmartLoader';
import AgentCard from './AgentCard';
import AgentDetail from './AgentDetail';
import ErrorDisplay from './ErrorDisplay';
import {
  getMockMarketplaceAgents,
  isMockMarketplaceAgent,
  renderMockMarketplaceAvatar,
} from './mockAgents';

interface AgentGridProps {
  category: string;
  searchQuery: string;
  sortOption?: AgentSortOption;
  viewMode?: MarketplaceViewMode;
  onSelectAgent: (agent: t.Agent) => void;
  onClearSearch?: () => void;
  onViewAll?: () => void;
  scrollElementRef?: React.RefObject<HTMLElement>;
}

export type AgentSortOption = 'featured' | 'newest' | 'oldest' | 'name' | 'name_desc' | 'category';
export type MarketplaceViewMode = 'compact' | 'large';

const getCategoryToneKey = (categoryValue: string | null | undefined) =>
  categoryValue
    ?.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'all';

const AgentGrid: React.FC<AgentGridProps> = ({
  category,
  searchQuery,
  sortOption = 'featured',
  viewMode = 'compact',
  onSelectAgent,
  onClearSearch,
  onViewAll,
  scrollElementRef,
}) => {
  const localize = useLocalize();
  const shouldReduceMotion = useReducedMotion();
  const isDesktopCatalog = useMediaQuery('(min-width: 960px)');
  const pageSize = isDesktopCatalog ? 10 : 9;
  const [detailAgent, setDetailAgent] = useState<t.Agent | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isTourDetailOpen, setIsTourDetailOpen] = useState(false);
  const emptyStateHeadingId = useId();
  const storefrontScrollRef = useRef<HTMLDivElement>(null);
  const { categories } = useAgentCategories();
  const shouldUseBackendDateSort = sortOption === 'newest' || sortOption === 'oldest';

  const queryParams = useMemo(() => {
    const params: {
      requiredPermission: number;
      category?: string;
      search?: string;
      limit: number;
      promoted?: 0 | 1;
      sortBy?: 'createdAt';
      sortDirection?: 'asc' | 'desc';
    } = {
      requiredPermission: PermissionBits.VIEW,
      limit: pageSize,
    };

    if (searchQuery) {
      params.search = searchQuery;
      if (category !== 'all' && category !== 'promoted') {
        params.category = category;
      }
    } else if (category === 'promoted') {
      params.promoted = 1;
    } else if (category !== 'all') {
      params.category = category;
    }

    if (shouldUseBackendDateSort) {
      params.sortBy = 'createdAt';
      params.sortDirection = sortOption === 'newest' ? 'desc' : 'asc';
    }

    return params;
  }, [category, pageSize, searchQuery, shouldUseBackendDateSort, sortOption]);

  const {
    data,
    isLoading,
    error,
    isFetching,
    fetchNextPage,
    hasNextPage,
    refetch,
    isFetchingNextPage,
  } = useMarketplaceAgentsInfiniteQuery(queryParams);

  const currentAgents = useMemo(() => {
    const pages = data?.pages ?? [];
    const agents = pages.flatMap((page) => page.data ?? []);

    if (sortOption === 'featured') {
      return agents;
    }

    if (shouldUseBackendDateSort) {
      return agents;
    }

    return [...agents].sort((firstAgent, secondAgent) => {
      if (sortOption === 'category') {
        const categoryOrder = (firstAgent.category ?? '').localeCompare(
          secondAgent.category ?? '',
          undefined,
          { sensitivity: 'base' },
        );

        if (categoryOrder !== 0) {
          return categoryOrder;
        }
      }

      if (sortOption === 'name_desc') {
        return (secondAgent.name ?? '').localeCompare(firstAgent.name ?? '', undefined, {
          sensitivity: 'base',
        });
      }

      return (firstAgent.name ?? '').localeCompare(secondAgent.name ?? '', undefined, {
        sensitivity: 'base',
      });
    });
  }, [data?.pages, shouldUseBackendDateSort, sortOption]);
  const mockAgents = useMemo(() => getMockMarketplaceAgents(localize), [localize]);
  const fallbackAgents = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLocaleLowerCase();
    const matchingAgents = mockAgents.filter((agent) => {
      const matchesCategory =
        category === 'all' || category === 'promoted' || agent.category === category;
      const matchesSearch =
        normalizedSearch.length === 0 ||
        agent.name?.toLocaleLowerCase().includes(normalizedSearch) ||
        agent.description?.toLocaleLowerCase().includes(normalizedSearch);

      return matchesCategory && matchesSearch;
    });

    if (sortOption === 'featured') {
      return matchingAgents;
    }

    return [...matchingAgents].sort((firstAgent, secondAgent) => {
      if (sortOption === 'newest') {
        return secondAgent.created_at - firstAgent.created_at;
      }

      if (sortOption === 'oldest') {
        return firstAgent.created_at - secondAgent.created_at;
      }

      if (sortOption === 'name_desc') {
        return (secondAgent.name ?? '').localeCompare(firstAgent.name ?? '', undefined, {
          sensitivity: 'base',
        });
      }

      return (firstAgent.name ?? '').localeCompare(secondAgent.name ?? '', undefined, {
        sensitivity: 'base',
      });
    });
  }, [category, mockAgents, searchQuery, sortOption]);
  const isUsingMockAgents =
    currentAgents.length === 0 && !isLoading && !isFetching && error == null;
  const displayedAgents = isUsingMockAgents ? fallbackAgents : currentAgents;
  const hasData = useHasData(data?.pages?.[0]);

  const animateStorefrontCard = useCallback(
    (button: HTMLButtonElement, isActive: boolean) => {
      if (shouldReduceMotion) {
        return;
      }

      const avatar = button.querySelector<HTMLElement>('.agents-marketplace-storefront-avatar');
      const icon = avatar?.querySelector<HTMLElement>('img, svg');

      gsap.to(button, {
        y: isActive ? -2 : 0,
        duration: 0.16,
        ease: 'power2.out',
        overwrite: true,
      });

      if (avatar) {
        gsap.to(avatar, {
          scale: isActive ? 1.018 : 1,
          duration: 0.16,
          ease: 'power2.out',
          overwrite: true,
        });
      }

      if (icon) {
        gsap.to(icon, {
          scale: isActive ? 1.03 : 1,
          duration: 0.16,
          ease: 'power2.out',
          overwrite: true,
        });
      }
    },
    [shouldReduceMotion],
  );

  const handleStorefrontCardEnter = useCallback(
    (event: React.FocusEvent<HTMLButtonElement> | React.PointerEvent<HTMLButtonElement>) => {
      animateStorefrontCard(event.currentTarget, true);
    },
    [animateStorefrontCard],
  );

  const handleStorefrontCardLeave = useCallback(
    (event: React.FocusEvent<HTMLButtonElement> | React.PointerEvent<HTMLButtonElement>) => {
      animateStorefrontCard(event.currentTarget, false);
    },
    [animateStorefrontCard],
  );

  useEffect(() => {
    setIsDetailOpen(false);
    setDetailAgent(null);
    setIsTourDetailOpen(false);
  }, [category, searchQuery]);

  useEffect(() => {
    const handleTourOpen = () => {
      const firstAgent = displayedAgents[0];

      if (firstAgent == null) {
        return;
      }

      if (!isMockMarketplaceAgent(firstAgent)) {
        onSelectAgent(firstAgent);
      }
      setDetailAgent(firstAgent);
      setIsDetailOpen(true);
      setIsTourDetailOpen(true);
    };
    const handleTourClose = () => {
      setIsTourDetailOpen(false);
      setIsDetailOpen(false);
    };

    window.addEventListener('marketplace-agent-tour-open', handleTourOpen);
    window.addEventListener('marketplace-agent-tour-close', handleTourClose);

    return () => {
      window.removeEventListener('marketplace-agent-tour-open', handleTourOpen);
      window.removeEventListener('marketplace-agent-tour-close', handleTourClose);
    };
  }, [displayedAgents, onSelectAgent]);

  const fetchMoreAgents = useCallback(() => {
    if (!hasNextPage || isFetchingNextPage) {
      return;
    }

    void fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const getStorefrontScrollElement = useCallback(
    () => scrollElementRef?.current ?? storefrontScrollRef.current,
    [scrollElementRef],
  );

  const handleStorefrontScroll = useCallback(() => {
    const scrollElement = getStorefrontScrollElement();

    if (scrollElement == null) {
      return;
    }

    const scrollThreshold = 96;
    const reachedBottom =
      scrollElement.scrollTop + scrollElement.clientHeight >=
      scrollElement.scrollHeight - scrollThreshold;

    if (reachedBottom) {
      fetchMoreAgents();
    }
  }, [fetchMoreAgents, getStorefrontScrollElement]);

  useEffect(() => {
    const scrollElement = scrollElementRef?.current;

    if (scrollElement == null || !isDesktopCatalog) {
      return;
    }

    scrollElement.addEventListener('scroll', handleStorefrontScroll, { passive: true });

    return () => {
      scrollElement.removeEventListener('scroll', handleStorefrontScroll);
    };
  }, [handleStorefrontScroll, isDesktopCatalog, scrollElementRef]);

  useEffect(() => {
    const scrollElement = getStorefrontScrollElement();

    if (scrollElement == null || !hasNextPage || isFetchingNextPage) {
      return;
    }

    if (scrollElement.scrollHeight <= scrollElement.clientHeight + 8) {
      fetchMoreAgents();
    }
  }, [
    displayedAgents.length,
    fetchMoreAgents,
    getStorefrontScrollElement,
    hasNextPage,
    isFetchingNextPage,
  ]);

  const getCategoryDisplayName = (categoryValue: string) => {
    const categoryData = categories.find((cat) => cat.value === categoryValue);
    if (categoryData?.label) {
      return categoryData.label.startsWith('com_')
        ? localize(categoryData.label as TranslationKeys)
        : categoryData.label;
    }

    if (categoryValue === 'promoted') {
      return localize('com_agents_top_picks');
    }
    if (categoryValue === 'all') {
      return localize('com_agents_all');
    }

    return categoryValue
      .split(/[_-]/)
      .filter(Boolean)
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(' ');
  };

  const emptyStateHeading = searchQuery
    ? localize('com_agents_search_empty_heading')
    : localize('com_agents_empty_state_heading');

  let emptyStateMessage = localize('com_agents_empty_state_message');
  if (searchQuery) {
    emptyStateMessage = localize('com_agents_search_no_results', { query: searchQuery });
  } else if (category !== 'all' && category !== 'promoted') {
    emptyStateMessage = localize('com_agents_category_empty', {
      category: getCategoryDisplayName(category),
    });
  } else if (category === 'promoted') {
    emptyStateMessage = localize('com_agents_recommended');
  }

  let emptyStateAction = {
    label: localize('com_agents_view_all'),
    onClick: onViewAll,
  };
  let EmptyStateActionIcon = ChevronRight;

  if (searchQuery) {
    emptyStateAction = {
      label: localize('com_agents_clear_search'),
      onClick: onClearSearch,
    };
    EmptyStateActionIcon = X;
  } else if (category === 'all') {
    emptyStateAction = {
      label: localize('com_agents_refresh_library'),
      onClick: () => refetch(),
    };
    EmptyStateActionIcon = RotateCw;
  }

  const handleOpenAgent = (agent: t.Agent) => {
    setIsTourDetailOpen(false);
    if (!isMockMarketplaceAgent(agent)) {
      onSelectAgent(agent);
    }
    setDetailAgent(agent);
    setIsDetailOpen(true);
  };

  if (error) {
    return (
      <ErrorDisplay
        error={error || 'Unknown error occurred'}
        onRetry={() => refetch()}
        context={{
          searchQuery,
          category,
        }}
      />
    );
  }

  if (displayedAgents.length === 0 && !isLoading && !isFetching) {
    return (
      <section
        className="agents-marketplace-empty"
        role="status"
        aria-live="polite"
        aria-labelledby={emptyStateHeadingId}
      >
        <motion.div
          initial={shouldReduceMotion ? false : 'hidden'}
          animate="visible"
          variants={softRevealVariants}
          className="agents-marketplace-empty-content"
        >
          <div className="agents-marketplace-empty-icon" aria-hidden="true">
            <Search className="h-6 w-6" />
          </div>
          <h3 id={emptyStateHeadingId}>{emptyStateHeading}</h3>
          <p>{emptyStateMessage}</p>
          {emptyStateAction.onClick && (
            <button
              type="button"
              className="agents-marketplace-empty-action"
              onClick={emptyStateAction.onClick}
            >
              <EmptyStateActionIcon className="h-4 w-4" aria-hidden="true" />
              {emptyStateAction.label}
            </button>
          )}
        </motion.div>
      </section>
    );
  }

  const listAnnouncement = localize('com_agents_grid_announcement', {
    count: displayedAgents.length,
    category: getCategoryDisplayName(category),
  });
  const loadingCardIndexes = Array.from(
    { length: isDesktopCatalog ? pageSize : 4 },
    (_, index) => index,
  );
  const loadingAnnouncement = localize('com_agents_loading');

  if (!isDesktopCatalog) {
    if (isLoading || (isFetching && !isFetchingNextPage)) {
      return (
        <div
          className="space-y-6"
          role="status"
          aria-live="polite"
          aria-label={loadingAnnouncement}
        >
          <span className="sr-only">{loadingAnnouncement}</span>
          <div className="agents-marketplace-loading-grid" aria-hidden="true">
            {loadingCardIndexes.map((index) => (
              <div
                key={index}
                className="agent-card-shell agent-card-shell--skeleton"
                data-view-mode={viewMode}
              >
                <div
                  className="agent-card-trigger agent-card-trigger--skeleton"
                  data-view-mode={viewMode}
                >
                  <div className="agent-card-avatar-shell agents-marketplace-loading-block agents-marketplace-loading-block--avatar" />
                  <div className="agent-card-copy">
                    <div className="agents-marketplace-loading-line agents-marketplace-loading-line--title" />
                    <div className="agents-marketplace-loading-line agents-marketplace-loading-line--meta" />
                    <div className="agents-marketplace-loading-line agents-marketplace-loading-line--body" />
                    <div className="agents-marketplace-loading-line agents-marketplace-loading-line--body-short" />
                  </div>
                  <div className="agents-marketplace-loading-block agents-marketplace-loading-block--chevron" />
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div
        className="space-y-6"
        data-tour-id="marketplace-results"
        data-tour-padding="0"
        data-tour-radius="22"
        role="tabpanel"
        id={`category-panel-${category}`}
        aria-labelledby={`category-tab-${category}`}
        aria-live="polite"
        aria-busy={isLoading && !hasData}
      >
        <div id="search-results-count" className="sr-only" aria-live="polite" aria-atomic="true">
          {listAnnouncement}
        </div>
        <motion.div
          variants={marketplaceCardStackVariants}
          initial={shouldReduceMotion ? false : 'hidden'}
          animate="visible"
          className="grid w-full grid-cols-1 items-start gap-3.5 xl:grid-cols-2 xl:gap-4"
          role="grid"
          aria-label={listAnnouncement}
        >
          {displayedAgents.map((agent: t.Agent, index: number) => (
            <motion.div
              key={`${agent.id}-${index}`}
              role="gridcell"
              variants={marketplaceCardRevealVariants}
            >
              <AgentCard
                agent={agent}
                onSelect={isMockMarketplaceAgent(agent) ? undefined : onSelectAgent}
                viewMode={viewMode}
              />
            </motion.div>
          ))}
        </motion.div>
      </div>
    );
  }

  if (isLoading || (isFetching && !isFetchingNextPage)) {
    return (
      <div className="space-y-6" role="status" aria-live="polite" aria-label={loadingAnnouncement}>
        <span className="sr-only">{loadingAnnouncement}</span>
        <div
          className="agents-marketplace-storefront-scroll agents-marketplace-storefront-scroll--loading"
          data-view-mode={viewMode}
          aria-hidden="true"
        >
          <div className="agents-marketplace-storefront agents-marketplace-storefront--loading">
            <div className="agents-marketplace-storefront-list agents-marketplace-storefront-list--loading">
              {loadingCardIndexes.map((index) => (
                <div
                  key={index}
                  className="agents-marketplace-storefront-row agents-marketplace-storefront-row--skeleton"
                  data-view-mode={viewMode}
                >
                  <div className="agents-marketplace-storefront-icon-wrap">
                    <div className="agents-marketplace-storefront-avatar agents-marketplace-loading-block agents-marketplace-loading-block--storefront-avatar" />
                  </div>
                  <div className="agents-marketplace-storefront-copy">
                    <div className="agents-marketplace-loading-line agents-marketplace-loading-line--title" />
                    <div className="agents-marketplace-loading-line agents-marketplace-loading-line--meta" />
                    <div className="agents-marketplace-loading-line agents-marketplace-loading-line--body" />
                    <div className="agents-marketplace-loading-line agents-marketplace-loading-line--body-short" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="space-y-6"
      data-tour-id="marketplace-results"
      data-tour-padding="0"
      data-tour-radius="22"
      role="tabpanel"
      id={`category-panel-${category}`}
      aria-labelledby={`category-tab-${category}`}
      aria-live="polite"
      aria-busy={isLoading && !hasData}
    >
      <div id="search-results-count" className="sr-only" aria-live="polite" aria-atomic="true">
        {listAnnouncement}
      </div>
      <motion.div
        ref={storefrontScrollRef}
        variants={marketplaceCardStackVariants}
        initial={shouldReduceMotion ? false : 'hidden'}
        animate="visible"
        onScroll={scrollElementRef?.current == null ? handleStorefrontScroll : undefined}
        className="agents-marketplace-storefront-scroll"
        data-view-mode={viewMode}
      >
        <div className="agents-marketplace-storefront" data-view-mode={viewMode}>
          <div
            className="agents-marketplace-storefront-list"
            role="list"
            aria-label={listAnnouncement}
          >
            {displayedAgents.map((agent, index) => {
              const storefrontCategoryLabel = agent.category
                ? getCategoryDisplayName(agent.category)
                : localize('com_agents_all');
              const toneKey = getCategoryToneKey(agent.category);
              const agentDisplayName = getAgentDisplayName(agent);

              return (
                <motion.div
                  key={`${agent.id}-${index}`}
                  role="listitem"
                  variants={marketplaceCardRevealVariants}
                >
                  <button
                    type="button"
                    data-testid={`agent-storefront-row-${agent.id}`}
                    data-category-tone={toneKey}
                    data-tour-id={index === 0 ? 'marketplace-agent' : undefined}
                    data-tour-padding={index === 0 ? '-2' : undefined}
                    data-tour-radius={index === 0 ? '22' : undefined}
                    className="agents-marketplace-storefront-row"
                    data-view-mode={viewMode}
                    aria-label={localize('com_agents_agent_card_label', {
                      name: agentDisplayName,
                      description: agent.description ?? '',
                    })}
                    onClick={() => handleOpenAgent(agent)}
                    onPointerEnter={handleStorefrontCardEnter}
                    onPointerLeave={handleStorefrontCardLeave}
                    onFocus={handleStorefrontCardEnter}
                    onBlur={handleStorefrontCardLeave}
                  >
                    <div className="agents-marketplace-storefront-icon-wrap" aria-hidden="true">
                      <div className="agents-marketplace-storefront-avatar">
                        {renderMockMarketplaceAvatar(agent, {
                          className: 'agents-marketplace-storefront-art',
                        }) ??
                          renderAgentAvatar(agent, {
                            size: 'fill',
                            showBorder: false,
                            fit: 'contain',
                            shape: 'rounded',
                            visualScale: 'contained',
                            className: 'agents-marketplace-storefront-art',
                          })}
                      </div>
                    </div>
                    <div className="agents-marketplace-storefront-copy">
                      <h3 className="agents-marketplace-storefront-title">{agentDisplayName}</h3>
                      <p className="agents-marketplace-storefront-meta">
                        {storefrontCategoryLabel}
                      </p>
                      {agent.description ? (
                        <p className="agents-marketplace-storefront-description">
                          {agent.description}
                        </p>
                      ) : null}
                    </div>
                    <span className="agents-marketplace-storefront-action" aria-hidden="true">
                      <ChevronRight className="size-5" strokeWidth={2.8} />
                    </span>
                  </button>
                </motion.div>
              );
            })}
          </div>
          {isFetchingNextPage ? (
            <div className="agents-marketplace-storefront-loading" role="status" aria-live="polite">
              <motion.span
                className="agents-marketplace-loading-pill"
                variants={marketplaceSurfaceRevealVariants}
                initial={shouldReduceMotion ? false : 'hidden'}
                animate="visible"
              >
                <span className="agents-marketplace-loading-pill-dot" aria-hidden="true" />
                <span className="text-sm font-medium text-text-secondary">
                  {localize('com_agents_loading')}
                </span>
              </motion.span>
            </div>
          ) : null}
        </div>
      </motion.div>

      {detailAgent && isDetailOpen ? (
        <AgentDetail
          agent={detailAgent}
          isOpen={isDetailOpen}
          isTourPreview={isTourDetailOpen}
          onClose={() => {
            setIsTourDetailOpen(false);
            setIsDetailOpen(false);
          }}
        />
      ) : null}
    </div>
  );
};

export default AgentGrid;
