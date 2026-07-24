import {
  useCallback,
  useEffect,
  useState,
  useMemo,
  memo,
  lazy,
  Suspense,
  useRef,
  startTransition,
} from 'react';
import { useRecoilValue } from 'recoil';
import { motion } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import { Briefcase, LayoutGrid, MessageSquareText, PanelLeftOpen, SquarePen } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Avatar, Button, Skeleton, TooltipAnchor, useMediaQuery } from '@librechat/client';
import { PermissionTypes, Permissions, QueryKeys } from 'librechat-data-provider';
import type { InfiniteQueryObserverResult } from '@tanstack/react-query';
import type { ConversationListResponse } from 'librechat-data-provider';
import type { List } from 'react-virtualized';
import {
  useLocalize,
  useHasAccess,
  useAuthContext,
  useLocalStorage,
  useNavScrolling,
  useNewConvo,
} from '~/hooks';
import {
  useConversationsInfiniteQuery,
  useCoworkAccessQuery,
  useTitleGeneration,
} from '~/data-provider';
import { Conversations } from '~/components/Conversations';
import { ProjectsNav } from '~/components/Projects';
import CoworkNavLink from '~/components/Cowork/CoworkNavLink'; // cowork
import FavoritesList from './Favorites/FavoritesList';
import HelpAndFaqButton from './HelpAndFaqButton';
import SearchBar from './SearchBar';
import NewChat from './NewChat';
import {
  SIDEBAR_FOCUS_DELAY_MS,
  SIDEBAR_ANIMATION_MS,
  SIDEBAR_ANIMATION_SECONDS,
  SIDEBAR_EASE_CSS,
  SIDEBAR_MOTION_EASE,
} from './sidebarMotion';
import { CLOSE_SIDEBAR_ID, OPEN_SIDEBAR_ID } from '~/components/Chat/Menus/OpenSidebar';
import { clearMessagesCache, cn } from '~/utils';
import store from '~/store';

const BookmarkNav = lazy(() => import('./Bookmarks/BookmarkNav'));
const AccountSettings = lazy(() => import('./AccountSettings'));

export const NAV_WIDTH = {
  MOBILE: 320,
  DESKTOP: 260,
  RAIL: 72,
} as const;

const CompactNav = memo(({ openSidebar }: { openSidebar: () => void }) => {
  const localize = useLocalize();
  const { user } = useAuthContext();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { newConversation } = useNewConvo();
  const { data: coworkAccess } = useCoworkAccessQuery();
  const conversation = useRecoilValue(store.conversationByIndex(0));

  const handleNewChat: React.MouseEventHandler<HTMLButtonElement> = useCallback(
    (event) => {
      if (event.button === 0 && (event.ctrlKey || event.metaKey)) {
        window.open('/c/new', '_blank');
        return;
      }

      clearMessagesCache(queryClient, conversation?.conversationId);
      queryClient.invalidateQueries([QueryKeys.messages]);
      newConversation();
    },
    [conversation?.conversationId, newConversation, queryClient],
  );

  const actionClassName = (active = false) =>
    cn(
      'inline-flex h-10 w-10 items-center justify-center rounded-xl border border-transparent text-[#DCE7FF] outline-none transition-all duration-200',
      'hover:border-white/10 hover:bg-white/10 hover:text-[#E8C37F] focus-visible:ring-2 focus-visible:ring-[#DAAC60]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#102A68]',
      active &&
        'border-white/55 bg-white text-[#10224A] shadow-[0_8px_22px_rgba(4,17,51,0.22)] hover:border-white hover:bg-white hover:text-[#B47D26]',
    );

  const openAndFocusSidebar = () => {
    openSidebar();
    setTimeout(() => {
      document.getElementById(CLOSE_SIDEBAR_ID)?.focus();
    }, SIDEBAR_FOCUS_DELAY_MS);
  };

  return (
    <nav
      aria-label={`${localize('com_ui_chat_history')} compact navigation`}
      className="flex h-full flex-col items-center px-2.5 py-4"
    >
      <div className="relative mb-4 h-8 w-11 overflow-hidden" aria-hidden="true">
        <img
          src="/assets/ethos-rays.png"
          alt=""
          className="absolute left-0 top-0 h-11 w-11 max-w-none object-contain"
        />
        <img
          src="/assets/ethos-arc.png"
          alt=""
          className="absolute left-0 top-0 h-11 w-11 max-w-none object-contain"
        />
      </div>

      <div className="flex flex-col items-center gap-2">
        <TooltipAnchor
          description={localize('com_nav_tooltip_new_chat')}
          side="right"
          render={
            <Button
              type="button"
              size="icon"
              variant="ghost"
              data-testid="compact-nav-new-chat-button"
              aria-label={localize('com_ui_new_chat')}
              className={actionClassName(location.pathname === '/c/new')}
              onClick={handleNewChat}
            >
              <SquarePen className="h-5 w-5" aria-hidden="true" />
            </Button>
          }
        />

        <div className="my-1 h-px w-7 bg-white/10" aria-hidden="true" />

        <TooltipAnchor
          description={localize('com_nav_tooltip_marketplace')}
          side="right"
          render={
            <Button
              asChild
              size="icon"
              variant="ghost"
              aria-label={localize('com_agents_marketplace')}
              className={actionClassName(location.pathname.startsWith('/agents'))}
            >
              <Link to="/agents">
                <LayoutGrid className="h-5 w-5" aria-hidden="true" />
              </Link>
            </Button>
          }
        />

        {coworkAccess?.allowed !== false && (
          <TooltipAnchor
            description={localize('com_nav_tooltip_cowork')}
            side="right"
            render={
              <Button
                asChild
                size="icon"
                variant="ghost"
                aria-label={localize('com_sidepanel_cowork_label')}
                className={cn(actionClassName(location.pathname.startsWith('/cowork')), 'group')}
              >
                <Link to="/cowork">
                  <Briefcase
                    className="h-5 w-5 text-white transition-colors duration-200 group-hover:text-[#DAAC60]"
                    aria-hidden="true"
                  />
                </Link>
              </Button>
            }
          />
        )}

        <TooltipAnchor
          description={localize('com_nav_tooltip_chat_history')}
          side="right"
          render={
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={localize('com_ui_chat_history')}
              className={actionClassName(
                location.pathname.startsWith('/c/') && location.pathname !== '/c/new',
              )}
              onClick={openAndFocusSidebar}
            >
              <MessageSquareText className="h-5 w-5" aria-hidden="true" />
            </Button>
          }
        />
      </div>

      <div className="mt-auto flex flex-col items-center gap-3">
        <HelpAndFaqButton compact className={actionClassName()} />
        <TooltipAnchor
          description={localize('com_nav_tooltip_open_sidebar')}
          side="right"
          render={
            <Button
              id={OPEN_SIDEBAR_ID}
              type="button"
              size="icon"
              variant="ghost"
              data-testid="open-sidebar-button"
              aria-label={localize('com_nav_open_sidebar')}
              aria-expanded={false}
              aria-controls="chat-history-nav"
              className={actionClassName()}
              onClick={openAndFocusSidebar}
            >
              <PanelLeftOpen className="h-5 w-5" aria-hidden="true" />
            </Button>
          }
        />
        <div className="h-px w-7 bg-white/10" aria-hidden="true" />
        <TooltipAnchor
          description={localize('com_nav_tooltip_account_settings')}
          side="right"
          render={
            <button
              type="button"
              aria-label={localize('com_nav_account_settings')}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/[0.08] text-xs font-semibold text-white transition-colors hover:border-[#DAAC60]/60 hover:text-[#E8C37F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DAAC60]/70"
              onClick={openAndFocusSidebar}
            >
              <Avatar user={user} size={32} />
            </button>
          }
        />
      </div>
    </nav>
  );
});

CompactNav.displayName = 'CompactNav';

const NavMask = memo(
  ({
    ariaLabel,
    navVisible,
    toggleNavVisible,
  }: {
    ariaLabel: string;
    navVisible: boolean;
    toggleNavVisible: () => void;
  }) => (
    <button
      type="button"
      id="mobile-nav-mask-toggle"
      className={cn(
        'nav-mask transition-opacity duration-200 ease-in-out',
        navVisible ? 'active opacity-100' : 'opacity-0',
      )}
      onClick={toggleNavVisible}
      aria-label={ariaLabel}
      aria-hidden={!navVisible}
      disabled={!navVisible}
      tabIndex={navVisible ? 0 : -1}
    />
  ),
);

const MemoNewChat = memo(NewChat);

const Nav = memo(
  ({
    navVisible,
    setNavVisible,
  }: {
    navVisible: boolean;
    setNavVisible: React.Dispatch<React.SetStateAction<boolean>>;
  }) => {
    const localize = useLocalize();
    const { isAuthenticated } = useAuthContext();
    useTitleGeneration(isAuthenticated);

    const isSmallScreen = useMediaQuery('(max-width: 768px)');
    const [newUser, setNewUser] = useLocalStorage('newUser', true);
    const [isChatsExpanded, setIsChatsExpanded] = useLocalStorage('chatsExpanded', true);
    const [showLoading, setShowLoading] = useState(false);
    const [tags, setTags] = useState<string[]>([]);

    const hasAccessToBookmarks = useHasAccess({
      permissionType: PermissionTypes.BOOKMARKS,
      permission: Permissions.USE,
    });

    const search = useRecoilValue(store.search);

    const { data, fetchNextPage, isFetchingNextPage, isLoading, isFetching, refetch } =
      useConversationsInfiniteQuery(
        {
          tags: tags.length === 0 ? undefined : tags,
          search: search.debouncedQuery || undefined,
        },
        {
          enabled: isAuthenticated,
          staleTime: 30000,
          cacheTime: 300000,
        },
      );

    const computedHasNextPage = useMemo(() => {
      if (data?.pages && data.pages.length > 0) {
        const lastPage: ConversationListResponse = data.pages[data.pages.length - 1];
        return lastPage.nextCursor !== null;
      }
      return false;
    }, [data?.pages]);

    const outerContainerRef = useRef<HTMLDivElement>(null);
    const conversationsRef = useRef<List | null>(null);

    const { moveToTop } = useNavScrolling<ConversationListResponse>({
      setShowLoading,
      fetchNextPage: async (options?) => {
        if (computedHasNextPage) {
          return fetchNextPage(options);
        }
        return Promise.resolve(
          {} as InfiniteQueryObserverResult<ConversationListResponse, unknown>,
        );
      },
      isFetchingNext: isFetchingNextPage,
    });

    const conversations = useMemo(() => {
      return data ? data.pages.flatMap((page) => page.conversations) : [];
    }, [data]);

    const toggleNavVisible = useCallback(() => {
      // Use startTransition to mark this as a non-urgent update
      // This prevents blocking the main thread during the cascade of re-renders
      startTransition(() => {
        setNavVisible((prev: boolean) => {
          localStorage.setItem('navVisible', JSON.stringify(!prev));
          return !prev;
        });
        if (newUser) {
          setNewUser(false);
        }
      });
    }, [newUser, setNavVisible, setNewUser]);

    useEffect(() => {
      if (isSmallScreen) {
        const savedNavVisible = localStorage.getItem('navVisible');
        if (savedNavVisible === null) {
          toggleNavVisible();
        }
      }
    }, [isSmallScreen, toggleNavVisible]);

    useEffect(() => {
      const handleTourOpen = () => {
        startTransition(() => {
          setNavVisible((previous) => {
            if (previous) {
              return previous;
            }

            localStorage.setItem('navVisible', JSON.stringify(true));
            return true;
          });
        });
      };

      const handleTourClose = () => {
        startTransition(() => {
          setNavVisible((previous) => {
            if (!previous) {
              return previous;
            }

            localStorage.setItem('navVisible', JSON.stringify(false));
            return false;
          });
        });
      };

      window.addEventListener('nav-tour-open', handleTourOpen as EventListener);
      window.addEventListener('nav-tour-close', handleTourClose as EventListener);

      return () => {
        window.removeEventListener('nav-tour-open', handleTourOpen as EventListener);
        window.removeEventListener('nav-tour-close', handleTourClose as EventListener);
      };
    }, [setNavVisible]);

    useEffect(() => {
      refetch();
    }, [tags, refetch]);

    const loadMoreConversations = useCallback(() => {
      if (isFetchingNextPage || !computedHasNextPage) {
        return;
      }

      fetchNextPage();
    }, [isFetchingNextPage, computedHasNextPage, fetchNextPage]);

    const headerButtons = useMemo(
      () => (
        <>
          {search.enabled !== null ? <SearchBar isSmallScreen={isSmallScreen} /> : null}
          {hasAccessToBookmarks && (
            <Suspense fallback={null}>
              <BookmarkNav tags={tags} setTags={setTags} />
            </Suspense>
          )}
        </>
      ),
      [hasAccessToBookmarks, isSmallScreen, search.enabled, tags],
    );

    const [isSearchLoading, setIsSearchLoading] = useState(
      !!search.query && (search.isTyping || isLoading || isFetching),
    );

    useEffect(() => {
      if (search.isTyping) {
        setIsSearchLoading(true);
      } else if (!isLoading && !isFetching) {
        setIsSearchLoading(false);
      } else if (!!search.query && (isLoading || isFetching)) {
        setIsSearchLoading(true);
      }
    }, [search.query, search.isTyping, isLoading, isFetching]);

    // Always render sidebar to avoid mount/unmount costs
    // Use transform for GPU-accelerated animation (no layout thrashing)
    const sidebarWidth = isSmallScreen ? NAV_WIDTH.MOBILE : NAV_WIDTH.DESKTOP;

    // Sidebar content (shared between mobile and desktop)
    const sidebarContent = (
      <div className="flex h-full flex-col">
        <nav
          id="chat-history-nav"
          aria-label={localize('com_ui_chat_history')}
          data-tour-clip-root="sidebar"
          className="flex h-full flex-col px-2 pb-3.5"
          aria-hidden={!navVisible}
          {...{ inert: !navVisible ? '' : undefined }}
        >
          <div className="flex flex-1 flex-col overflow-hidden" ref={outerContainerRef}>
            <MemoNewChat toggleNav={toggleNavVisible} headerButtons={headerButtons} />
            <FavoritesList />
            <CoworkNavLink />
            <ProjectsNav />
            <div className="flex min-h-0 flex-grow flex-col overflow-hidden">
              <Conversations
                conversations={conversations}
                moveToTop={moveToTop}
                containerRef={conversationsRef}
                loadMoreConversations={loadMoreConversations}
                isLoading={isFetchingNextPage || showLoading || isLoading}
                isSearchLoading={isSearchLoading}
                showFavorites={false}
                isChatsExpanded={isChatsExpanded}
                setIsChatsExpanded={setIsChatsExpanded}
              />
            </div>
          </div>
          <HelpAndFaqButton />
          <Suspense fallback={<Skeleton className="mt-1 h-12 w-full rounded-xl" />}>
            <AccountSettings />
          </Suspense>
        </nav>
      </div>
    );

    // Mobile: Fixed positioned sidebar that slides over content
    // Uses CSS transitions (not Framer Motion) to sync perfectly with content animation
    if (isSmallScreen) {
      return (
        <>
          <div
            data-testid="nav"
            className={cn(
              'nav sidebar-rail sidebar-shell-divider fixed left-0 top-0 z-[110] h-full bg-surface-primary-alt',
              navVisible && 'active',
            )}
            style={{
              width: sidebarWidth,
              transform: navVisible ? 'translateX(0)' : `translateX(-${sidebarWidth}px)`,
              transition: `transform ${SIDEBAR_ANIMATION_MS}ms ${SIDEBAR_EASE_CSS}`,
              willChange: 'transform',
            }}
          >
            {sidebarContent}
          </div>
          <NavMask
            ariaLabel={localize('com_nav_close_sidebar')}
            navVisible={navVisible}
            toggleNavVisible={toggleNavVisible}
          />
        </>
      );
    }

    // Desktop: Inline sidebar with width transition
    return (
      <div
        className={cn(
          'relative flex-shrink-0',
          navVisible ? 'overflow-hidden' : 'overflow-visible',
        )}
        style={{
          width: navVisible ? sidebarWidth : NAV_WIDTH.RAIL,
          transition: `width ${SIDEBAR_ANIMATION_MS}ms ${SIDEBAR_EASE_CSS}`,
          willChange: 'width',
        }}
      >
        <motion.div
          data-testid="nav"
          className={cn(
            'nav sidebar-rail sidebar-shell-divider h-full bg-surface-primary-alt',
            navVisible && 'active',
          )}
          style={{ width: sidebarWidth }}
          initial={false}
          animate={{
            x: navVisible ? 0 : -sidebarWidth,
          }}
          transition={{ duration: SIDEBAR_ANIMATION_SECONDS, ease: SIDEBAR_MOTION_EASE }}
        >
          {sidebarContent}
        </motion.div>
        <motion.div
          data-testid="compact-nav"
          className="sidebar-rail sidebar-shell-divider absolute left-0 top-0 h-full bg-surface-primary-alt"
          style={{ width: NAV_WIDTH.RAIL }}
          initial={false}
          animate={{
            x: navVisible ? -NAV_WIDTH.RAIL : 0,
          }}
          transition={{ duration: SIDEBAR_ANIMATION_SECONDS, ease: SIDEBAR_MOTION_EASE }}
          aria-hidden={navVisible}
          {...{ inert: navVisible ? '' : undefined }}
        >
          <CompactNav openSidebar={toggleNavVisible} />
        </motion.div>
      </div>
    );
  },
);

Nav.displayName = 'Nav';

export default Nav;
