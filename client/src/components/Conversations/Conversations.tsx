import { useMemo, memo, useCallback, useEffect, useRef } from 'react';
import throttle from 'lodash/throttle';
import { ChevronDown } from 'lucide-react';
import { useRecoilValue } from 'recoil';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Spinner, TooltipAnchor, useMediaQuery } from '@librechat/client';
import { List, AutoSizer, CellMeasurer, CellMeasurerCache } from 'react-virtualized';
import type { CSSProperties, FC, LegacyRef, ReactNode, RefObject } from 'react';
import type { TConversation } from 'librechat-data-provider';
import type { TranslationKeys } from '~/hooks';
import { useLocalize, useFavorites, useShowMarketplace } from '~/hooks';
import FavoritesList from '~/components/Nav/Favorites/FavoritesList';
import { isMockNavigationConversation } from '~/components/Nav/mockNavigation';
import { useActiveJobs } from '~/data-provider';
import { groupConversationsByDate, cn } from '~/utils';
import Convo from './Convo';
import store from '~/store';

export type CellPosition = {
  columnIndex: number;
  rowIndex: number;
};

export type MeasuredCellParent = {
  invalidateCellSizeAfterRender?: ((cell: CellPosition) => void) | undefined;
  recomputeGridSize?: ((cell: CellPosition) => void) | undefined;
};

interface ConversationsProps {
  conversations: Array<TConversation | null>;
  moveToTop: () => void;
  containerRef: RefObject<List>;
  loadMoreConversations: () => void;
  isLoading: boolean;
  isSearchLoading: boolean;
  showFavorites?: boolean;
  isChatsExpanded: boolean;
  setIsChatsExpanded: (expanded: boolean) => void;
}

interface MeasuredRowProps {
  cache: CellMeasurerCache;
  rowKey: string;
  parent: MeasuredCellParent;
  index: number;
  style: CSSProperties;
  children: ReactNode;
}

/** Reusable wrapper for virtualized row measurement */
const MeasuredRow: FC<MeasuredRowProps> = memo(
  ({ cache, rowKey, parent, index, style, children }) => (
    <CellMeasurer cache={cache} columnIndex={0} key={rowKey} parent={parent} rowIndex={index}>
      {({ registerChild }) => (
        <div ref={registerChild as LegacyRef<HTMLDivElement>} style={style}>
          {children}
        </div>
      )}
    </CellMeasurer>
  ),
);

MeasuredRow.displayName = 'MeasuredRow';

const LoadingSpinner = memo(() => {
  const localize = useLocalize();

  return (
    <div className="mx-auto mt-2 flex items-center justify-center gap-2">
      <Spinner className="text-text-primary" />
      <span className="animate-pulse text-text-primary">{localize('com_ui_loading')}</span>
    </div>
  );
});

LoadingSpinner.displayName = 'LoadingSpinner';

interface ChatsHeaderProps {
  isExpanded: boolean;
  onToggle: () => void;
  count: number;
}

/** Collapsible header for the Chats section */
const ChatsHeader: FC<ChatsHeaderProps> = memo(({ isExpanded, onToggle, count }) => {
  const localize = useLocalize();
  return (
    <TooltipAnchor
      description={localize('com_nav_tooltip_chat_history')}
      render={
        <button
          onClick={onToggle}
          className="sidebar-section-toggle group flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-xs outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black dark:focus-visible:ring-white"
          type="button"
          aria-expanded={isExpanded}
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className="sidebar-section-heading select-none">{localize('com_ui_chats')}</span>
            <span className="sidebar-section-total" aria-hidden="true">
              {count}
            </span>
          </span>
          <span className="sidebar-section-toggle-icon flex h-5 w-5 items-center justify-center rounded-md">
            <ChevronDown
              className={cn(
                'h-3 w-3 transition-transform duration-200',
                isExpanded ? 'rotate-180' : '',
              )}
            />
          </span>
        </button>
      }
    />
  );
});

ChatsHeader.displayName = 'ChatsHeader';

const DateLabel: FC<{ groupName: string; isFirst?: boolean }> = memo(({ groupName, isFirst }) => {
  const localize = useLocalize();
  return (
    <h2
      className={cn(
        'sidebar-date-label px-3 pt-2 text-text-secondary',
        isFirst === true ? 'mt-0' : 'mt-2',
      )}
    >
      {localize(groupName as TranslationKeys) || groupName}
    </h2>
  );
});

DateLabel.displayName = 'DateLabel';

type FlattenedItem =
  | { type: 'favorites' }
  | { type: 'header'; groupName: string }
  | { type: 'convo'; convo: TConversation }
  | { type: 'loading' };

const MemoizedConvo = memo(
  ({
    conversation,
    retainView,
    isGenerating,
    onMockSelect,
  }: {
    conversation: TConversation;
    retainView: () => void;
    isGenerating: boolean;
    onMockSelect: (conversation: TConversation) => void;
  }) => {
    return (
      <Convo
        conversation={conversation}
        retainView={retainView}
        isGenerating={isGenerating}
        onMockSelect={onMockSelect}
      />
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.conversation.conversationId === nextProps.conversation.conversationId &&
      prevProps.conversation.title === nextProps.conversation.title &&
      prevProps.conversation.endpoint === nextProps.conversation.endpoint &&
      prevProps.isGenerating === nextProps.isGenerating &&
      prevProps.onMockSelect === nextProps.onMockSelect
    );
  },
);

const Conversations: FC<ConversationsProps> = ({
  conversations: rawConversations,
  moveToTop,
  containerRef,
  loadMoreConversations,
  isLoading,
  isSearchLoading,
  showFavorites = true,
  isChatsExpanded,
  setIsChatsExpanded,
}) => {
  const localize = useLocalize();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const search = useRecoilValue(store.search);
  const { favorites, isLoading: isFavoritesLoading } = useFavorites();
  const isSmallScreen = useMediaQuery('(max-width: 768px)');
  const convoHeight = isSmallScreen ? 44 : 34;
  const showAgentMarketplace = useShowMarketplace();

  // Fetch active job IDs for showing generation indicators
  const { data: activeJobsData } = useActiveJobs();
  const activeJobIds = useMemo(
    () => new Set(activeJobsData?.activeJobIds ?? []),
    [activeJobsData?.activeJobIds],
  );

  const handleMockConversationSelect = useCallback(
    (conversation: TConversation) => {
      if (!isMockNavigationConversation(conversation.conversationId)) {
        return;
      }
      const conversationId = conversation.conversationId;
      if (!conversationId) {
        return;
      }

      const nextSearchParams = new URLSearchParams(searchParams);
      if (conversation.projectId) {
        nextSearchParams.set('projectId', conversation.projectId);
      } else {
        nextSearchParams.delete('projectId');
      }
      const queryString = nextSearchParams.toString();
      const path = `/c/${encodeURIComponent(conversationId)}${queryString ? `?${queryString}` : ''}`;
      document.title = conversation.title || localize('com_ui_new_chat');
      navigate(path, { state: { focusChat: true } });
    },
    [localize, navigate, searchParams],
  );

  // Determine if FavoritesList will render content
  const shouldShowFavorites =
    showFavorites &&
    !search.query &&
    (isFavoritesLoading || favorites.length > 0 || showAgentMarketplace);

  const filteredConversations = useMemo(
    () => rawConversations.filter(Boolean) as TConversation[],
    [rawConversations],
  );

  const groupedConversations = useMemo(
    () => groupConversationsByDate(filteredConversations),
    [filteredConversations],
  );

  const flattenedItems = useMemo(() => {
    const items: FlattenedItem[] = [];
    // Only include favorites row if FavoritesList will render content
    if (shouldShowFavorites) {
      items.push({ type: 'favorites' });
    }
    if (isChatsExpanded) {
      groupedConversations.forEach(([groupName, convos]) => {
        items.push({ type: 'header', groupName });
        items.push(...convos.map((convo) => ({ type: 'convo' as const, convo })));
      });

      if (isLoading) {
        items.push({ type: 'loading' });
      }
    }
    return items;
  }, [groupedConversations, isLoading, isChatsExpanded, shouldShowFavorites]);

  // Store flattenedItems in a ref for keyMapper to access without recreating cache
  const flattenedItemsRef = useRef(flattenedItems);
  flattenedItemsRef.current = flattenedItems;

  // Create a stable cache that doesn't depend on flattenedItems
  const cache = useMemo(
    () =>
      new CellMeasurerCache({
        fixedWidth: true,
        defaultHeight: convoHeight,
        keyMapper: (index) => {
          const item = flattenedItemsRef.current[index];
          if (!item) {
            return `unknown-${index}`;
          }
          if (item.type === 'favorites') {
            return 'favorites';
          }
          if (item.type === 'header') {
            return `header-${item.groupName}`;
          }
          if (item.type === 'convo') {
            return `convo-${item.convo.conversationId}`;
          }
          if (item.type === 'loading') {
            return 'loading';
          }
          return `unknown-${index}`;
        },
      }),
    [convoHeight],
  );

  // Debounced function to clear cache and recompute heights
  const clearFavoritesCache = useCallback(() => {
    if (cache) {
      cache.clear(0, 0);
      if (containerRef.current && 'recomputeRowHeights' in containerRef.current) {
        containerRef.current.recomputeRowHeights(0);
      }
    }
  }, [cache, containerRef]);

  // Clear cache when favorites change
  useEffect(() => {
    const frameId = requestAnimationFrame(() => {
      clearFavoritesCache();
    });
    return () => cancelAnimationFrame(frameId);
  }, [favorites.length, isFavoritesLoading, clearFavoritesCache]);

  const rowRenderer = useCallback(
    ({ index, key, parent, style }) => {
      const item = flattenedItems[index];
      const rowProps = { cache, rowKey: key, parent, index, style };

      if (item.type === 'loading') {
        return (
          <MeasuredRow key={key} {...rowProps}>
            <LoadingSpinner />
          </MeasuredRow>
        );
      }

      if (item.type === 'favorites') {
        return (
          <MeasuredRow key={key} {...rowProps}>
            <FavoritesList onHeightChange={clearFavoritesCache} />
          </MeasuredRow>
        );
      }

      if (item.type === 'header') {
        const firstHeaderIndex = shouldShowFavorites ? 1 : 0;
        return (
          <MeasuredRow key={key} {...rowProps}>
            <DateLabel groupName={item.groupName} isFirst={index === firstHeaderIndex} />
          </MeasuredRow>
        );
      }

      if (item.type === 'convo') {
        const isGenerating = activeJobIds.has(item.convo.conversationId ?? '');
        return (
          <MeasuredRow key={key} {...rowProps}>
            <MemoizedConvo
              conversation={item.convo}
              retainView={moveToTop}
              isGenerating={isGenerating}
              onMockSelect={handleMockConversationSelect}
            />
          </MeasuredRow>
        );
      }

      return null;
    },
    [
      cache,
      flattenedItems,
      moveToTop,
      clearFavoritesCache,
      shouldShowFavorites,
      activeJobIds,
      handleMockConversationSelect,
    ],
  );

  const getRowHeight = useCallback(
    ({ index }: { index: number }) => cache.getHeight(index, 0),
    [cache],
  );

  const throttledLoadMore = useMemo(
    () => throttle(loadMoreConversations, 300),
    [loadMoreConversations],
  );

  const handleRowsRendered = useCallback(
    ({ stopIndex }: { stopIndex: number }) => {
      if (stopIndex >= flattenedItems.length - 8) {
        throttledLoadMore();
      }
    },
    [flattenedItems.length, throttledLoadMore],
  );

  return (
    <div className="chat-sidebar-list relative flex h-full min-h-0 flex-col pb-2 text-sm text-text-primary">
      <ChatsHeader
        isExpanded={isChatsExpanded}
        onToggle={() => setIsChatsExpanded(!isChatsExpanded)}
        count={filteredConversations.length}
      />
      {isSearchLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <Spinner className="text-text-primary" />
          <span className="ml-2 text-text-primary">{localize('com_ui_loading')}</span>
        </div>
      ) : (
        <div className="chat-sidebar-scroll flex-1">
          <AutoSizer>
            {({ width, height }) => (
              <List
                ref={containerRef}
                width={width}
                height={height}
                deferredMeasurementCache={cache}
                rowCount={flattenedItems.length}
                rowHeight={getRowHeight}
                rowRenderer={rowRenderer}
                overscanRowCount={10}
                aria-readonly={false}
                className="outline-none"
                aria-label={localize('com_ui_chat_history')}
                onRowsRendered={handleRowsRendered}
                tabIndex={-1}
                style={{ outline: 'none' }}
                containerRole="rowgroup"
              />
            )}
          </AutoSizer>
        </div>
      )}
    </div>
  );
};

export default memo(Conversations);
