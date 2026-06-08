import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useOutletContext, useParams, useNavigate } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { TooltipAnchor, Button, NewChatIcon, useMediaQuery } from '@librechat/client';
import {
  Constants,
  EModelEndpoint,
  PermissionTypes,
  Permissions,
  QueryKeys,
  getDefaultParamsEndpoint,
  getEndpointField,
  isAgentsEndpoint,
  isParamEndpoint,
} from 'librechat-data-provider';
import type t from 'librechat-data-provider';
import type { AgentSortOption, MarketplaceViewMode } from './AgentGrid';
import type { ContextType } from '~/common';
import {
  useDocumentTitle,
  useHasAccess,
  useLocalize,
  TranslationKeys,
  useLocalStorage,
} from '~/hooks';
import { useGetEndpointsQuery, useGetAgentCategoriesQuery } from '~/data-provider';
import { SidePanelProvider, useChatContext } from '~/Providers';
import { OpenSidebar } from '~/components/Chat/Menus';
import ChatBackgroundLights from '~/components/Chat/ChatBackgroundLights';
import { SidePanelGroup } from '~/components/SidePanel';
import {
  marketplaceHeroItemVariants,
  marketplaceHeroShellVariants,
  marketplaceSurfaceRevealVariants,
  sectionStaggerVariants,
} from '~/utils/motion';
import { cn, clearMessagesCache, getDefaultEndpoint } from '~/utils';
import CategoryTabs from './CategoryTabs';
import SearchBar from './SearchBar';
import AgentGrid from './AgentGrid';
import MarketplaceControlPanel from './MarketplaceControlPanel';
import { getFriendlyAgentCategoryLabel } from '~/hooks/Agents/useAgentCategories';

interface AgentMarketplaceProps {
  className?: string;
}

const isUsableMarketplaceEndpoint = (endpoint?: string | null, endpointType?: string | null) =>
  !!endpoint && !isAgentsEndpoint(endpoint) && isParamEndpoint(endpoint, endpointType ?? '');

const resolveMarketplaceSidePanelContext = ({
  conversation,
  endpointsConfig,
}: {
  conversation: t.TConversation | null;
  endpointsConfig: t.TEndpointsConfig;
}) => {
  const getResolvedEndpointType = (endpoint?: string | null) =>
    (getEndpointField(endpointsConfig, endpoint, 'type') as EModelEndpoint | null | undefined) ??
    null;

  const conversationEndpoint = conversation?.endpoint ?? null;
  const conversationEndpointType =
    conversation?.endpointType ?? getResolvedEndpointType(conversationEndpoint);

  if (isUsableMarketplaceEndpoint(conversationEndpoint, conversationEndpointType)) {
    return {
      endpoint: conversationEndpoint as EModelEndpoint,
      endpointType: conversationEndpointType,
    };
  }

  const defaultEndpoint = getDefaultEndpoint({
    convoSetup: conversation ?? {},
    endpointsConfig,
  });
  const defaultParamsEndpoint =
    defaultEndpoint != null ? getDefaultParamsEndpoint(endpointsConfig, defaultEndpoint) : null;
  const candidateEndpoints = [
    defaultParamsEndpoint ?? null,
    defaultEndpoint ?? null,
    ...Object.keys(endpointsConfig ?? {}),
  ].filter(
    (value, index, values): value is string => value != null && values.indexOf(value) === index,
  );
  const resolvedEndpoint = candidateEndpoints.find((candidate) =>
    isUsableMarketplaceEndpoint(candidate, getResolvedEndpointType(candidate)),
  );

  return {
    endpoint: (resolvedEndpoint as EModelEndpoint | undefined) ?? null,
    endpointType: getResolvedEndpointType(resolvedEndpoint),
  };
};

/**
 * AgentMarketplace - Main component for browsing and discovering agents
 *
 * Provides tabbed navigation for different agent categories,
 * search functionality, and detailed agent view through a modal dialog.
 * Uses URL parameters for state persistence and deep linking.
 */
const AgentMarketplace: React.FC<AgentMarketplaceProps> = ({ className = '' }) => {
  const localize = useLocalize();
  const navigate = useNavigate();
  const { category } = useParams();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { conversation, newConversation, setConversation } = useChatContext();

  const isSmallScreen = useMediaQuery('(max-width: 767px)');
  const shouldReduceMotion = useReducedMotion();
  const { navVisible, setNavVisible } = useOutletContext<ContextType>();

  // Get URL parameters
  const searchQuery = searchParams.get('q') || '';
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Animation state
  type Direction = 'left' | 'right';
  // Initialize with a default value to prevent rendering issues
  const [displayCategory, setDisplayCategory] = useState<string>(category || 'all');
  const [nextCategory, setNextCategory] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);
  const [animationDirection, setAnimationDirection] = useState<Direction>('right');
  const [sortOption, setSortOption] = useState<AgentSortOption>('featured');
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const [isMarketplacePanelOpen, setIsMarketplacePanelOpen] = useState(false);
  const [viewMode, setViewMode] = useLocalStorage<MarketplaceViewMode>(
    'agents-marketplace:view-mode',
    'compact',
  );

  // Ref for the scrollable container to enable infinite scroll
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  // Set page title
  useDocumentTitle(`${localize('com_agents_marketplace')}`);

  // Ensure endpoints config is loaded first (required for agent queries)
  const { data: endpointsConfig = {} as t.TEndpointsConfig } = useGetEndpointsQuery();

  // Fetch categories using existing query pattern
  const categoriesQuery = useGetAgentCategoriesQuery({
    staleTime: 1000 * 60 * 15, // 15 minutes - categories rarely change
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });
  const categories = useMemo(() => {
    const nextCategories = Array.isArray(categoriesQuery.data) ? [...categoriesQuery.data] : [];
    const allCategoryIndex = nextCategories.findIndex((item) => item.value === 'all');

    if (allCategoryIndex <= 0) {
      return nextCategories;
    }

    const [allCategory] = nextCategories.splice(allCategoryIndex, 1);
    return allCategory != null ? [allCategory, ...nextCategories] : nextCategories;
  }, [categoriesQuery.data]);
  const marketplaceSidePanelContext = useMemo(
    () => resolveMarketplaceSidePanelContext({ conversation, endpointsConfig }),
    [conversation, endpointsConfig],
  );

  useEffect(() => {
    if (
      conversation?.conversationId != null &&
      conversation.conversationId !== Constants.NEW_CONVO
    ) {
      return;
    }

    if (
      isUsableMarketplaceEndpoint(
        conversation?.endpoint,
        conversation?.endpointType ??
          getEndpointField(endpointsConfig, conversation?.endpoint, 'type'),
      )
    ) {
      return;
    }

    if (!marketplaceSidePanelContext.endpoint) {
      return;
    }

    setConversation((prev) => {
      if (
        isUsableMarketplaceEndpoint(
          prev?.endpoint,
          prev?.endpointType ?? getEndpointField(endpointsConfig, prev?.endpoint, 'type'),
        )
      ) {
        return prev;
      }

      const nextConversation = {
        ...prev,
        conversationId: prev?.conversationId ?? Constants.NEW_CONVO,
        title: prev?.title ?? 'New Chat',
        createdAt: prev?.createdAt ?? '',
        updatedAt: prev?.updatedAt ?? '',
        endpoint: marketplaceSidePanelContext.endpoint,
        endpointType: marketplaceSidePanelContext.endpointType,
      };

      if (
        prev?.conversationId === nextConversation.conversationId &&
        prev?.title === nextConversation.title &&
        prev?.createdAt === nextConversation.createdAt &&
        prev?.updatedAt === nextConversation.updatedAt &&
        prev?.endpoint === nextConversation.endpoint &&
        (prev?.endpointType ?? null) === nextConversation.endpointType
      ) {
        return prev;
      }

      return nextConversation;
    });
  }, [
    conversation?.conversationId,
    conversation?.endpoint,
    conversation?.endpointType,
    endpointsConfig,
    marketplaceSidePanelContext.endpoint,
    marketplaceSidePanelContext.endpointType,
    setConversation,
  ]);

  useEffect(() => {
    if (!isSortMenuOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (sortMenuRef.current?.contains(event.target as Node)) {
        return;
      }

      setIsSortMenuOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsSortMenuOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isSortMenuOpen]);

  useEffect(() => {
    if (
      !category &&
      window.location.pathname === '/agents' &&
      categories.length > 0 &&
      displayCategory === 'all'
    ) {
      const hasPromoted = categories.some((item) => item.value === 'promoted');

      if (hasPromoted) {
        setDisplayCategory('promoted');
      }
    }
  }, [category, categories, displayCategory]);

  /**
   * Handle agent card selection - updates URL for deep linking
   */
  const handleAgentSelect = (agent: t.Agent) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('agent_id', agent.id);
    setSearchParams(newParams);
  };

  /**
   * Determine ordered tabs to compute indices for direction
   */
  const orderedTabs = useMemo<string[]>(() => {
    const dynamic = categories.map((c) => c.value);
    // Only include values that actually exist in the categories
    const set = new Set<string>(dynamic);
    return Array.from(set);
  }, [categories]);

  const getTabIndex = useCallback(
    (tab: string): number => {
      const idx = orderedTabs.indexOf(tab);
      return idx >= 0 ? idx : 0;
    },
    [orderedTabs],
  );

  /**
   * Handle category tab selection changes with directional animation
   */
  const handleTabChange = (tabValue: string) => {
    if (tabValue === displayCategory || isTransitioning) {
      // Ignore redundant or rapid clicks during transition
      return;
    }

    const currentIndex = getTabIndex(displayCategory);
    const newIndex = getTabIndex(tabValue);
    const direction: Direction = newIndex > currentIndex ? 'right' : 'left';

    setAnimationDirection(direction);
    setNextCategory(tabValue);
    setIsTransitioning(true);

    // Update URL immediately, preserving current search params
    const currentSearchParams = searchParams.toString();
    const searchParamsStr = currentSearchParams ? `?${currentSearchParams}` : '';
    if (tabValue === 'promoted') {
      navigate(`/agents${searchParamsStr}`);
    } else {
      navigate(`/agents/${tabValue}${searchParamsStr}`);
    }

    // Complete transition after 300ms
    window.setTimeout(() => {
      setDisplayCategory(tabValue);
      setNextCategory(null);
      setIsTransitioning(false);
    }, 300);
  };

  /**
   * Sync display when URL changes externally (back/forward)
   */
  useEffect(() => {
    if (category && category !== displayCategory && !isTransitioning) {
      // URL changed externally, update display without animation
      setDisplayCategory(category);
    }
  }, [category, displayCategory, isTransitioning]);

  // No longer needed with keyframes

  /**
   * Handle search query changes
   *
   * @param query - The search query string
   */
  const handleSearch = (query: string) => {
    const newParams = new URLSearchParams(searchParams);
    const currentCategory = displayCategory;

    if (query.trim()) {
      newParams.set('q', query.trim());
    } else {
      newParams.delete('q');
    }

    // Always preserve current category when searching or clearing search
    if (currentCategory === 'promoted') {
      navigate(`/agents${newParams.toString() ? `?${newParams.toString()}` : ''}`);
    } else {
      navigate(
        `/agents/${currentCategory}${newParams.toString() ? `?${newParams.toString()}` : ''}`,
      );
    }
  };

  /**
   * Handle new chat button click
   */

  const handleNewChat = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (e.button === 0 && (e.ctrlKey || e.metaKey)) {
      window.open('/c/new', '_blank');
      return;
    }
    clearMessagesCache(queryClient, conversation?.conversationId);
    queryClient.invalidateQueries([QueryKeys.messages]);
    newConversation();
  };

  const surfaceShellClassName =
    'agents-marketplace-shell w-full min-w-0 px-5 md:px-8 xl:px-12 2xl:px-16';
  const canvasClassName = 'agents-marketplace-canvas relative flex min-h-full min-w-0 flex-col';
  const shouldShowMarketplaceTopbar = !isSmallScreen && !navVisible;
  const getCategoryMeta = (value: string | null) => {
    if (value === 'promoted') {
      return {
        name: localize('com_agents_top_picks'),
        description: localize('com_agents_recommended'),
      };
    }

    if (!value || value === 'all') {
      return {
        name: localize('com_agents_all'),
        description: localize('com_agents_all_description'),
      };
    }

    const categoryData = categories.find((cat) => cat.value === value);
    if (categoryData) {
      return {
        name: getFriendlyAgentCategoryLabel({
          value: categoryData.value,
          label: categoryData.label,
          localize,
        }),
        description: categoryData.description?.startsWith('com_')
          ? localize(categoryData.description as TranslationKeys)
          : categoryData.description || '',
      };
    }

    return {
      name: value.charAt(0).toUpperCase() + value.slice(1),
      description: '',
    };
  };

  const hasAccessToMarketplace = useHasAccess({
    permissionType: PermissionTypes.MARKETPLACE,
    permission: Permissions.USE,
  });
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    if (!hasAccessToMarketplace) {
      timeoutId = setTimeout(() => {
        navigate('/c/new');
      }, 1000);
    }
    return () => {
      clearTimeout(timeoutId);
    };
  }, [hasAccessToMarketplace, navigate]);

  if (!hasAccessToMarketplace) {
    return null;
  }

  const currentCategoryMeta = getCategoryMeta(displayCategory);
  const nextCategoryMeta = nextCategory ? getCategoryMeta(nextCategory) : null;
  const sortOptions: Array<{ value: AgentSortOption; label: string }> = [
    { value: 'featured', label: localize('com_agents_sort_featured') },
    { value: 'newest', label: localize('com_agents_sort_newest') },
    { value: 'oldest', label: localize('com_agents_sort_oldest') },
    { value: 'name', label: localize('com_agents_sort_name') },
    { value: 'name_desc', label: localize('com_agents_sort_name_desc') },
    { value: 'category', label: localize('com_agents_sort_category') },
  ];
  const activeSortLabel =
    sortOptions.find((option) => option.value === sortOption)?.label ??
    localize('com_agents_sort_featured');
  const marketplaceSignals = [
    localize('com_agents_marketplace_signal_curated'),
    localize('com_agents_marketplace_signal_guided'),
    localize('com_agents_marketplace_signal_classroom'),
  ];
  const sortControl = (
    <div className="agents-marketplace-sort-control" ref={sortMenuRef}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isSortMenuOpen}
        aria-label={localize('com_agents_sort_by')}
        className="agents-marketplace-sort-trigger"
        onClick={() => setIsSortMenuOpen((currentValue) => !currentValue)}
      >
        <span className="agents-marketplace-sort-label">{localize('com_agents_sort_by')}</span>
        <span className="agents-marketplace-sort-value">{activeSortLabel}</span>
        <ChevronDown aria-hidden="true" className="agents-marketplace-sort-chevron" />
      </button>
      {isSortMenuOpen && (
        <div className="agents-marketplace-sort-menu" role="listbox">
          {sortOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === sortOption}
              className="agents-marketplace-sort-option"
              onClick={() => {
                setSortOption(option.value);
                setIsSortMenuOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
  const viewOptions: Array<{ value: MarketplaceViewMode; label: string }> = [
    { value: 'compact', label: localize('com_agents_view_compact') },
    { value: 'large', label: localize('com_agents_view_large') },
  ];
  const viewControl = (
    <div
      className="agents-marketplace-view-control"
      role="group"
      aria-label={localize('com_agents_view')}
    >
      <span className="agents-marketplace-view-label">{localize('com_agents_view')}</span>
      <div className="agents-marketplace-view-switch">
        {viewOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            className="agents-marketplace-view-option"
            data-active={viewMode === option.value ? 'true' : 'false'}
            aria-pressed={viewMode === option.value}
            onClick={() => setViewMode(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
  const renderResultsControls = () => (
    <div className="agents-marketplace-results-controls">
      {viewControl}
      {sortControl}
    </div>
  );
  const marketplaceMainContent = (
    <main
      ref={scrollContainerRef}
      className="agents-marketplace-main scrollbar-gutter-stable flex h-full min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden"
      role="main"
    >
      <div className={canvasClassName}>
        {shouldShowMarketplaceTopbar && (
          <div className="agents-marketplace-topbar sticky top-0 z-20">
            <div className="agents-marketplace-topbar-inner flex h-14 items-center px-4 md:px-5">
              <div className="flex items-center gap-2">
                <div className="agents-marketplace-quick-actions">
                  <OpenSidebar
                    setNavVisible={setNavVisible}
                    className="agents-marketplace-topbar-button"
                  />
                  <TooltipAnchor
                    description={localize('com_ui_new_chat')}
                    render={
                      <Button
                        size="icon"
                        variant="ghost"
                        data-testid="agents-new-chat-button"
                        aria-label={localize('com_ui_new_chat')}
                        className="agents-marketplace-topbar-button max-md:hidden"
                        onClick={handleNewChat}
                      >
                        <NewChatIcon />
                      </Button>
                    }
                  />
                </div>
              </div>
            </div>
          </div>
        )}
        <motion.header
          initial={shouldReduceMotion ? false : 'hidden'}
          animate="visible"
          className={cn(
            'agents-marketplace-hero',
            surfaceShellClassName,
            isSmallScreen ? 'pt-4' : 'pt-5 md:pt-7',
          )}
        >
          <motion.div
            className="agents-marketplace-hero-shell"
            variants={marketplaceHeroShellVariants}
          >
            <div className="agents-marketplace-heading-row agents-marketplace-hero-top">
              <div className="agents-marketplace-hero-intro">
                <motion.div
                  className="agents-marketplace-heading"
                  variants={marketplaceHeroItemVariants}
                >
                  <h1 className="agents-marketplace-page-title text-text-primary">
                    {localize('com_agents_marketplace')}
                  </h1>
                  <p className="agents-marketplace-page-subtitle max-w-3xl text-text-secondary">
                    {localize('com_agents_marketplace_subtitle')}
                  </p>
                </motion.div>
                <motion.div
                  className="agents-marketplace-page-signals agents-marketplace-page-signals--hero"
                  aria-label={localize('com_agents_marketplace_signals_label')}
                  variants={marketplaceHeroItemVariants}
                >
                  {marketplaceSignals.map((signal) => (
                    <span key={signal}>{signal}</span>
                  ))}
                </motion.div>
              </div>
              {isSmallScreen && (
                <motion.div
                  className="agents-marketplace-header-actions"
                  variants={marketplaceHeroItemVariants}
                >
                  <MarketplaceControlPanel className="agents-marketplace-panel-trigger--hero" />
                </motion.div>
              )}
            </div>
          </motion.div>
        </motion.header>
        <div
          className={cn(
            'agents-marketplace-filter-stack sticky z-10 pb-4 pt-0 md:pb-5 md:pt-1',
            shouldShowMarketplaceTopbar && 'agents-marketplace-filter-stack--nav-collapsed',
            shouldShowMarketplaceTopbar ? 'top-14' : 'top-0',
          )}
        >
          <div className={surfaceShellClassName}>
            <motion.div
              variants={sectionStaggerVariants}
              initial={shouldReduceMotion ? false : 'hidden'}
              animate="visible"
              transition={
                shouldReduceMotion ? { duration: 0 } : { delay: 0.02, duration: 0.24 }
              }
              className="agents-marketplace-toolbar px-4 pb-4 pt-4 md:px-5 md:pb-4 md:pt-4"
            >
              <motion.div
                className="agents-marketplace-toolbar-row items-start"
                variants={marketplaceSurfaceRevealVariants}
              >
                <SearchBar
                  value={searchQuery}
                  onSearch={handleSearch}
                  onFocusChange={setIsSearchFocused}
                  className="agents-marketplace-hero-search"
                />
              </motion.div>

              <motion.div
                className="agents-marketplace-hero-categories mt-4 md:mt-5"
                variants={marketplaceSurfaceRevealVariants}
              >
                <CategoryTabs
                  categories={categories}
                  activeTab={displayCategory}
                  isLoading={categoriesQuery.isLoading}
                  onChange={handleTabChange}
                />
              </motion.div>
            </motion.div>
          </div>
        </div>
        <div
          className={cn(
            surfaceShellClassName,
            isSmallScreen ? 'pb-8' : 'pb-10',
            shouldShowMarketplaceTopbar && 'agents-marketplace-results-shell--nav-collapsed',
          )}
        >
          <motion.section
            variants={sectionStaggerVariants}
            initial={shouldReduceMotion ? false : 'hidden'}
            animate="visible"
            className={cn(
              'agents-marketplace-results relative overflow-hidden',
              shouldShowMarketplaceTopbar && 'agents-marketplace-results--nav-collapsed',
            )}
          >
            <motion.div
              className={cn(
                isTransitioning &&
                  (animationDirection === 'right'
                    ? 'motion-safe:animate-slide-out-left'
                    : 'motion-safe:animate-slide-out-right'),
              )}
              key={`pane-current-${displayCategory}`}
              variants={marketplaceSurfaceRevealVariants}
            >
              {!searchQuery && (
                <div className="agents-marketplace-results-heading">
                  <div className="agents-marketplace-section-header">
                    <div className="min-w-0 text-left">
                      <h2 className="agents-marketplace-section-title text-text-primary">
                        {currentCategoryMeta.name}
                      </h2>
                      {currentCategoryMeta.description && (
                        <p className="agents-marketplace-section-subtitle mt-2 max-w-3xl text-text-secondary">
                          {currentCategoryMeta.description}
                        </p>
                      )}
                    </div>
                    {renderResultsControls()}
                  </div>
                </div>
              )}

              <div className="agents-marketplace-grid-shell">
                <AgentGrid
                  key={`grid-${displayCategory}`}
                  category={displayCategory}
                  searchQuery={searchQuery}
                  sortOption={sortOption}
                  viewMode={viewMode}
                  onSelectAgent={handleAgentSelect}
                  scrollElementRef={scrollContainerRef}
                />
              </div>
            </motion.div>

            {isTransitioning && nextCategory && (
              <motion.div
                className={cn(
                  'absolute inset-0',
                  animationDirection === 'right'
                    ? 'motion-safe:animate-slide-in-right'
                    : 'motion-safe:animate-slide-in-left',
                )}
                key={`pane-next-${nextCategory}-${animationDirection}`}
                variants={marketplaceSurfaceRevealVariants}
              >
                {!searchQuery && nextCategoryMeta && (
                  <div className="agents-marketplace-results-heading">
                    <div className="agents-marketplace-section-header">
                      <div className="min-w-0 text-left">
                        <h2 className="agents-marketplace-section-title text-text-primary">
                          {nextCategoryMeta.name}
                        </h2>
                        {nextCategoryMeta.description && (
                          <p className="agents-marketplace-section-subtitle mt-2 max-w-3xl text-text-secondary">
                            {nextCategoryMeta.description}
                          </p>
                        )}
                      </div>
                      {renderResultsControls()}
                    </div>
                  </div>
                )}

                <div className="agents-marketplace-grid-shell">
                  <AgentGrid
                    key={`grid-${nextCategory}`}
                    category={nextCategory}
                    searchQuery={searchQuery}
                    sortOption={sortOption}
                    viewMode={viewMode}
                    onSelectAgent={handleAgentSelect}
                    scrollElementRef={scrollContainerRef}
                  />
                </div>
              </motion.div>
            )}
          </motion.section>
        </div>
      </div>
    </main>
  );

  return (
    <div
      className={cn(
        'agents-marketplace-page relative flex w-full grow overflow-hidden',
        isSearchFocused && 'agents-marketplace-page--search-focused',
        !isSmallScreen && isMarketplacePanelOpen && 'agents-marketplace-page--panel-open',
        className,
      )}
    >
      <ChatBackgroundLights mode="marketplace" />
      <SidePanelProvider
        endpoint={marketplaceSidePanelContext.endpoint}
        endpointType={marketplaceSidePanelContext.endpointType}
      >
        {isSmallScreen ? (
          marketplaceMainContent
        ) : (
          <SidePanelGroup
            className="bg-transparent"
            defaultCollapsed={true}
            fullPanelCollapse={true}
            clickAwayCollapseMode="rail"
            onPanelOpenChange={setIsMarketplacePanelOpen}
          >
            {marketplaceMainContent}
          </SidePanelGroup>
        )}
      </SidePanelProvider>
    </div>
  );
};

export default AgentMarketplace;
