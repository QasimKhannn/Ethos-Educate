import React, { forwardRef, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { isToday, subDays, startOfDay, isWithinInterval } from 'date-fns';
import debounce from 'lodash/debounce';
import { MessageCircle, PenSquare, Search, X } from 'lucide-react';
import { Button, Dialog, DialogContent, Spinner, TooltipAnchor } from '@librechat/client';
import { useNavigate } from 'react-router-dom';
import type { ConversationListResponse } from 'librechat-data-provider';
import { useConversationsInfiniteQuery } from '~/data-provider';
import { useLocalize, useNewConvo } from '~/hooks';

type SearchBarProps = {
  isSmallScreen?: boolean;
};

type SearchConversation = ConversationListResponse['conversations'][number];

const SEARCH_GROUP_ORDER = [
  'com_ui_date_today',
  'com_ui_date_yesterday',
  'com_ui_date_previous_30_days',
] as const;

const getGroupLabel = (updatedAt?: string) => {
  const now = new Date(Date.now());
  const date = updatedAt != null ? new Date(updatedAt) : now;

  if (isToday(date)) {
    return 'com_ui_date_today' as const;
  }

  if (isWithinInterval(date, { start: startOfDay(subDays(now, 1)), end: now })) {
    return 'com_ui_date_yesterday' as const;
  }

  return 'com_ui_date_previous_30_days' as const;
};

const groupSearchConversations = (conversations: SearchConversation[]) => {
  const groups = new Map<(typeof SEARCH_GROUP_ORDER)[number], SearchConversation[]>();
  const orderedConversations = [...conversations].sort(
    (left, right) =>
      new Date(right.updatedAt ?? 0).getTime() - new Date(left.updatedAt ?? 0).getTime(),
  );

  orderedConversations.forEach((conversation) => {
    const label = getGroupLabel(conversation.updatedAt);
    const existingGroup = groups.get(label) ?? [];
    existingGroup.push(conversation);
    groups.set(label, existingGroup);
  });

  return SEARCH_GROUP_ORDER.filter((label) => groups.has(label)).map((label) => ({
    label,
    conversations: groups.get(label) ?? [],
  }));
};

const ChatSearchModal = ({
  open,
  onOpenChange,
  isSmallScreen = false,
  isTourPreview = false,
}: {
  open: boolean;
  onOpenChange: (isOpen: boolean) => void;
  isSmallScreen?: boolean;
  isTourPreview?: boolean;
}) => {
  const navigate = useNavigate();
  const localize = useLocalize();
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [debouncedText, setDebouncedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showClearIcon, setShowClearIcon] = useState(false);
  const { newConversation } = useNewConvo();

  const debouncedSetQuery = useMemo(
    () =>
      debounce((value: string) => {
        setDebouncedText(value);
        setIsTyping(false);
      }, 250),
    [],
  );

  const resetSearch = useCallback(() => {
    debouncedSetQuery.cancel();
    setText('');
    setDebouncedText('');
    setIsTyping(false);
    setShowClearIcon(false);
  }, [debouncedSetQuery]);

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) {
        resetSearch();
      }
      onOpenChange(isOpen);
    },
    [onOpenChange, resetSearch],
  );

  const onChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setText(value);
      setShowClearIcon(value.length > 0);
      setIsTyping(true);
      debouncedSetQuery(value.trim());
    },
    [debouncedSetQuery],
  );

  const { data, isLoading, isFetching } = useConversationsInfiniteQuery(
    {
      search: debouncedText || undefined,
    },
    {
      enabled: open,
      staleTime: 30000,
      cacheTime: 300000,
    },
  );

  const conversations = useMemo(
    () => (data != null ? data.pages.flatMap((page) => page.conversations) : []),
    [data],
  );

  const groupedConversations = useMemo(
    () => groupSearchConversations(conversations),
    [conversations],
  );
  const showLoadingState =
    ((isLoading || isFetching) && conversations.length === 0) ||
    (isTyping && conversations.length === 0);

  const handleClear = useCallback(() => {
    resetSearch();
    inputRef.current?.focus();
  }, [resetSearch]);

  const handleNewChat = useCallback(() => {
    handleOpenChange(false);
    newConversation({ disableFocus: true });
    navigate('/c/new', { state: { focusChat: true } });
  }, [handleOpenChange, navigate, newConversation]);

  const handleSelectConversation = useCallback(
    (conversationId: string) => {
      handleOpenChange(false);
      navigate(`/c/${conversationId}`, { state: { focusChat: true } });
    },
    [handleOpenChange, navigate],
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    const animationFrame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(animationFrame);
  }, [open]);

  useEffect(() => () => debouncedSetQuery.cancel(), [debouncedSetQuery]);

  const renderSearchResults = () => {
    if (showLoadingState) {
      return (
        <div className="sidebar-search-dialog-empty">
          <Spinner className="sidebar-search-dialog-spinner" />
        </div>
      );
    }

    if (conversations.length === 0) {
      return (
        <div className="sidebar-search-dialog-empty">{localize('com_ui_no_results_found')}</div>
      );
    }

    return groupedConversations.map((group) => (
      <section key={group.label} className="sidebar-search-dialog-group">
        <p className="sidebar-search-dialog-group-label">{localize(group.label)}</p>
        <div className="sidebar-search-dialog-group-list">
          {group.conversations.map((conversation) => {
            const conversationId = conversation.conversationId;

            if (!conversationId) {
              return null;
            }

            return (
              <button
                key={conversationId}
                type="button"
                className="sidebar-search-dialog-row"
                onClick={() => handleSelectConversation(conversationId)}
              >
                <MessageCircle className="sidebar-search-dialog-row-icon" aria-hidden="true" />
                <span className="sidebar-search-dialog-row-title">
                  {conversation.title || localize('com_ui_untitled')}
                </span>
              </button>
            );
          })}
        </div>
      </section>
    ));
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange} modal={!isTourPreview}>
      <DialogContent
        showCloseButton={false}
        data-tour-id="nav-search-dialog"
        data-tour-padding="-4"
        data-tour-radius="22"
        className={
          isSmallScreen
            ? 'sidebar-search-dialog h-[min(36rem,calc(100vh-1.5rem))] w-[calc(100vw-1rem)] max-w-none gap-0 overflow-hidden p-0'
            : 'sidebar-search-dialog w-[min(42rem,calc(100vw-4rem))] max-w-none gap-0 overflow-hidden p-0'
        }
      >
        <div className="sidebar-search-dialog-header">
          <div className="sidebar-search-dialog-input-shell">
            <Search className="sidebar-search-dialog-input-icon" aria-hidden="true" />
            <input
              ref={inputRef}
              type="text"
              value={text}
              onChange={onChange}
              aria-label={localize('com_nav_search_chats_placeholder')}
              placeholder={localize('com_nav_search_chats_placeholder')}
              autoComplete="off"
              dir="auto"
              className="sidebar-search-dialog-input"
            />
            {showClearIcon && (
              <button
                type="button"
                aria-label={localize('com_ui_clear_search')}
                className="sidebar-search-dialog-clear"
                onClick={handleClear}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
          <button
            type="button"
            aria-label={localize('com_ui_close')}
            className="sidebar-search-dialog-close"
            onClick={() => handleOpenChange(false)}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="sidebar-search-dialog-body">
          <button type="button" className="sidebar-search-dialog-action" onClick={handleNewChat}>
            <PenSquare className="h-4 w-4" aria-hidden="true" />
            <span>{localize('com_ui_new_chat')}</span>
          </button>
          <div className="sidebar-search-dialog-results">{renderSearchResults()}</div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const SearchBar = forwardRef(
  ({ isSmallScreen = false }: SearchBarProps, ref: React.Ref<HTMLDivElement>) => {
    const localize = useLocalize();
    const [open, setOpen] = useState(false);
    const [isTourPreview, setIsTourPreview] = useState(false);

    useEffect(() => {
      const handleTourOpen = () => {
        setIsTourPreview(true);
        setOpen(true);
      };
      const handleTourClose = () => {
        setIsTourPreview(false);
        setOpen(false);
      };

      window.addEventListener('nav-search-tour-open', handleTourOpen);
      window.addEventListener('nav-search-tour-close', handleTourClose);

      return () => {
        window.removeEventListener('nav-search-tour-open', handleTourOpen);
        window.removeEventListener('nav-search-tour-close', handleTourClose);
      };
    }, []);

    return (
      <div ref={ref}>
        <TooltipAnchor
          description={localize('com_nav_search_placeholder')}
          render={
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={localize('com_nav_search_chats_placeholder')}
              aria-haspopup="dialog"
              aria-expanded={open}
              data-tour-id="nav-search"
              data-tour-clip="sidebar"
              data-tour-padding="-3"
              data-tour-offset-x="1"
              data-tour-offset-y="-1"
              data-tour-radius="18"
              className="sidebar-toolbar-button"
              onClick={() => setOpen(true)}
            >
              <Search aria-hidden="true" className="sidebar-toolbar-symbol" />
            </Button>
          }
        />
        <ChatSearchModal
          open={open}
          onOpenChange={setOpen}
          isSmallScreen={isSmallScreen}
          isTourPreview={isTourPreview}
        />
      </div>
    );
  },
);

export default SearchBar;
