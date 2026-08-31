import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowUpDown, ListFilter } from 'lucide-react';
import { Dropdown, useMediaQuery } from '@librechat/client';
import {
  Constants,
  EModelEndpoint,
  PermissionTypes,
  Permissions,
  SystemRoles,
  getDefaultParamsEndpoint,
  getEndpointField,
  isAgentsEndpoint,
  isParamEndpoint,
} from 'librechat-data-provider';
import type t from 'librechat-data-provider';
import type { AgentSortOption } from './AgentGrid';
import {
  useDocumentTitle,
  useAgentCategories,
  useHasAccess,
  useLocalize,
  useAuthContext,
} from '~/hooks';
import { useGetEndpointsQuery } from '~/data-provider';
import { SidePanelProvider, useChatContext } from '~/Providers';
import ChatBackgroundLights from '~/components/Chat/ChatBackgroundLights';
import { SidePanelGroup } from '~/components/SidePanel';
import {
  marketplaceHeroItemVariants,
  marketplaceHeroShellVariants,
  marketplaceSurfaceRevealVariants,
  sectionStaggerVariants,
} from '~/utils/motion';
import { cn, getDefaultEndpoint } from '~/utils';
import SearchBar from './SearchBar';
import AgentGrid from './AgentGrid';
import MarketplaceControlPanel from './MarketplaceControlPanel';

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
 * Provides agent search, sorting, and direct chat entry.
 * Uses URL parameters for state persistence and deep linking.
 */
const AgentMarketplace: React.FC<AgentMarketplaceProps> = ({ className = '' }) => {
  const localize = useLocalize();
  const { user } = useAuthContext();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { conversation, setConversation } = useChatContext();

  const isSmallScreen = useMediaQuery('(max-width: 767px)');
  const shouldReduceMotion = useReducedMotion();

  // Get URL parameters
  const searchQuery = searchParams.get('q') || '';
  const selectedCategory = searchParams.get('category') || 'all';
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const [sortOption, setSortOption] = useState<AgentSortOption>('featured');
  const [isMarketplacePanelOpen, setIsMarketplacePanelOpen] = useState(false);

  // Ref for the scrollable container to enable infinite scroll
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Set page title
  useDocumentTitle(`${localize('com_agents_marketplace')}`);

  // Ensure endpoints config is loaded first (required for agent queries)
  const { data: endpointsConfig = {} as t.TEndpointsConfig } = useGetEndpointsQuery();
  const { categories: agentCategories } = useAgentCategories();

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

  /**
   * Handle agent card selection - updates URL for deep linking
   */
  const handleAgentSelect = (agent: t.Agent) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('agent_id', agent.id);
    setSearchParams(newParams);
  };

  /**
   * Handle search query changes
   *
   * @param query - The search query string
   */
  const handleSearch = (query: string) => {
    const newParams = new URLSearchParams(searchParams);

    if (query.trim()) {
      newParams.set('q', query.trim());
    } else {
      newParams.delete('q');
    }

    navigate(`/agents${newParams.toString() ? `?${newParams.toString()}` : ''}`);
  };

  const handleCategoryChange = (category: string) => {
    const newParams = new URLSearchParams(searchParams);

    if (category === 'all') {
      newParams.delete('category');
    } else {
      newParams.set('category', category);
    }

    navigate(`/agents${newParams.toString() ? `?${newParams.toString()}` : ''}`);
  };

  /**
   * Handle new chat button click
   */

  const surfaceShellClassName =
    'agents-marketplace-shell w-full min-w-0 px-5 md:px-8 xl:px-12 2xl:px-16';
  const canvasClassName = 'agents-marketplace-canvas relative flex min-h-full min-w-0 flex-col';
  const allAgentsMeta = {
    name: localize('com_agents_all'),
    description: localize('com_agents_all_description'),
  };

  const hasAccessToMarketplace = useHasAccess({
    permissionType: PermissionTypes.MARKETPLACE,
    permission: Permissions.USE,
  });
  const canManageMarketplace = user?.role === SystemRoles.ADMIN;
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    if (!hasAccessToMarketplace && !canManageMarketplace) {
      timeoutId = setTimeout(() => {
        navigate('/c/new');
      }, 1000);
    }
    return () => {
      clearTimeout(timeoutId);
    };
  }, [hasAccessToMarketplace, canManageMarketplace, navigate]);

  if (!hasAccessToMarketplace && !canManageMarketplace) {
    return null;
  }

  const sortOptions: Array<{ value: AgentSortOption; label: string }> = [
    { value: 'featured', label: localize('com_agents_sort_featured') },
    { value: 'newest', label: localize('com_agents_sort_newest') },
    { value: 'oldest', label: localize('com_agents_sort_oldest') },
    { value: 'name', label: localize('com_agents_sort_name') },
    { value: 'name_desc', label: localize('com_agents_sort_name_desc') },
  ];
  const categoryOptions = [
    { value: 'all', label: localize('com_agents_all_category') },
    ...agentCategories.map((category) => ({
      value: category.value,
      label: category.label,
    })),
  ];
  const categoryControl = (
    <Dropdown
      data-tour-id="marketplace-categories"
      value={selectedCategory}
      onChange={handleCategoryChange}
      options={categoryOptions}
      icon={
        <span className="agents-marketplace-category-icon" aria-hidden="true">
          <ListFilter />
        </span>
      }
      label=""
      renderValue={(option) => (
        <span className="agents-marketplace-category-copy">
          <span className="agents-marketplace-category-label">
            {localize('com_agents_filter_by_category')}
          </span>
          <span className="agents-marketplace-category-value">{option.label}</span>
        </span>
      )}
      ariaLabel={localize('com_agents_filter_by_category')}
      containerClassName="agents-marketplace-category-control"
      triggerClassName="agents-marketplace-category-trigger"
      contentClassName="agents-marketplace-category-menu"
      itemClassName="agents-marketplace-category-option"
      arrowClassName="agents-marketplace-category-chevron"
      showSelectedIndicator={false}
      portal={false}
    />
  );
  const sortControl = (
    <Dropdown
      value={sortOption}
      onChange={(value) => setSortOption(value as AgentSortOption)}
      options={sortOptions}
      icon={
        <span className="agents-marketplace-sort-icon" aria-hidden="true">
          <ArrowUpDown />
        </span>
      }
      label=""
      renderValue={(option) => (
        <span className="agents-marketplace-sort-copy">
          <span className="agents-marketplace-sort-label">{localize('com_agents_sort_by')}</span>
          <span className="agents-marketplace-sort-value">{option.label}</span>
        </span>
      )}
      ariaLabel={localize('com_agents_sort_by')}
      containerClassName="agents-marketplace-sort-control"
      triggerClassName="agents-marketplace-sort-trigger"
      contentClassName="agents-marketplace-sort-menu"
      itemClassName="agents-marketplace-sort-option"
      arrowClassName="agents-marketplace-sort-chevron"
      showSelectedIndicator={false}
      portal={false}
    />
  );
  const renderResultsControls = () => (
    <div className="agents-marketplace-results-controls">
      {categoryControl}
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
                  <div className="agents-marketplace-title-lockup">
                    <span className="agents-marketplace-title-mark" aria-hidden="true">
                      <img src="/assets/ethos-rays.png" alt="" />
                      <img src="/assets/ethos-arc.png" alt="" />
                    </span>
                    <h1 className="agents-marketplace-page-title text-text-primary">
                      {localize('com_agents_marketplace')}
                    </h1>
                  </div>
                </motion.div>
              </div>
              <motion.div
                className="agents-marketplace-header-actions"
                variants={marketplaceHeroItemVariants}
              >
                <div className="agents-marketplace-control-card">
                  <div className="agents-marketplace-control-card-copy">
                    <span className="agents-marketplace-control-card-title">
                      {localize('com_agents_marketplace_control_title')}
                    </span>
                  </div>
                  <MarketplaceControlPanel
                    className="agents-marketplace-panel-trigger--hero"
                    isOpen={isMarketplacePanelOpen}
                  />
                </div>
              </motion.div>
            </div>
          </motion.div>
        </motion.header>
        <div
          className={cn(
            'agents-marketplace-filter-stack sticky z-10 pb-0 pt-0 md:pb-1 md:pt-1',
            'top-0',
          )}
        >
          <div className={surfaceShellClassName}>
            <motion.div
              variants={sectionStaggerVariants}
              initial={shouldReduceMotion ? false : 'hidden'}
              animate="visible"
              transition={shouldReduceMotion ? { duration: 0 } : { delay: 0.02, duration: 0.24 }}
              className="agents-marketplace-toolbar px-4 pb-2 pt-4 md:px-5 md:pb-2 md:pt-4"
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
            </motion.div>
          </div>
        </div>
        <div className={cn(surfaceShellClassName, isSmallScreen ? 'pb-8' : 'pb-10')}>
          <motion.section
            variants={sectionStaggerVariants}
            initial={shouldReduceMotion ? false : 'hidden'}
            animate="visible"
            className="agents-marketplace-results relative overflow-hidden"
          >
            <motion.div key="pane-all-agents" variants={marketplaceSurfaceRevealVariants}>
              {!searchQuery && (
                <div className="agents-marketplace-results-heading">
                  <div className="agents-marketplace-section-header">
                    <div className="min-w-0 text-left">
                      <h2 className="agents-marketplace-section-title text-text-primary">
                        {allAgentsMeta.name}
                      </h2>
                      {allAgentsMeta.description && (
                        <p className="agents-marketplace-section-subtitle mt-2 max-w-3xl text-text-secondary">
                          {allAgentsMeta.description}
                        </p>
                      )}
                    </div>
                    {renderResultsControls()}
                  </div>
                </div>
              )}

              <div className="agents-marketplace-grid-shell">
                <AgentGrid
                  key={`grid-${selectedCategory}`}
                  category={selectedCategory}
                  searchQuery={searchQuery}
                  sortOption={sortOption}
                  viewMode="large"
                  onSelectAgent={handleAgentSelect}
                  onClearSearch={() => handleSearch('')}
                  scrollElementRef={scrollContainerRef}
                />
              </div>
            </motion.div>
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
