import { useState, useId, useMemo, useCallback, useEffect } from 'react';
import * as Ariakit from '@ariakit/react';
import { Bookmark, BookmarkCheck } from 'lucide-react';
import { CrossCircledIcon } from '@radix-ui/react-icons';
import { DropdownPopup, TooltipAnchor } from '@librechat/client';
import { BookmarkFilledIcon, BookmarkIcon } from '@radix-ui/react-icons';
import type * as t from '~/common';
import type { FC } from 'react';
import { useGetConversationTags } from '~/data-provider';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';

type BookmarkNavProps = {
  tags: string[];
  setTags: (tags: string[]) => void;
};

const BookmarkNav: FC<BookmarkNavProps> = ({ tags, setTags }: BookmarkNavProps) => {
  const localize = useLocalize();
  const menuId = useId();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isTourPreview, setIsTourPreview] = useState(false);
  const { data } = useGetConversationTags();

  const buttonAriaLabel = useMemo(() => {
    if (tags.length === 0) {
      return localize('com_ui_bookmarks');
    }
    return localize('com_ui_bookmarks_count_selected', { count: tags.length });
  }, [tags.length, localize]);

  const bookmarks = useMemo(() => {
    if (!Array.isArray(data)) {
      return [];
    }

    return data.filter((tag) => tag.count > 0);
  }, [data]);

  const handleTagClick = useCallback(
    (tag: string) => {
      if (tags.includes(tag)) {
        setTags(tags.filter((t) => t !== tag));
      } else {
        setTags([...tags, tag]);
      }
    },
    [tags, setTags],
  );

  const handleClear = useCallback(() => {
    setTags([]);
  }, [setTags]);

  useEffect(() => {
    const handleTourOpen = () => {
      setIsTourPreview(true);
      setIsMenuOpen(true);
    };
    const handleTourClose = () => {
      setIsTourPreview(false);
      setIsMenuOpen(false);
    };

    window.addEventListener('nav-bookmarks-tour-open', handleTourOpen);
    window.addEventListener('nav-bookmarks-tour-close', handleTourClose);

    return () => {
      window.removeEventListener('nav-bookmarks-tour-open', handleTourOpen);
      window.removeEventListener('nav-bookmarks-tour-close', handleTourClose);
    };
  }, []);

  const dropdownItems: t.MenuItemProps[] = useMemo(() => {
    const items: t.MenuItemProps[] = [
      {
        id: 'clear-all',
        label: localize('com_ui_clear_all'),
        icon: <CrossCircledIcon className="size-4" />,
        hideOnClick: false,
        onClick: handleClear,
      },
    ];

    if (bookmarks.length === 0) {
      items.push({
        id: 'no-bookmarks',
        label: localize('com_ui_no_bookmarks'),
        icon: '🤔',
        disabled: true,
      });
    } else {
      for (const bookmark of bookmarks) {
        const isSelected = tags.includes(bookmark.tag);
        items.push({
          id: bookmark.tag,
          label: bookmark.tag,
          hideOnClick: false,
          icon: isSelected ? (
            <BookmarkFilledIcon className="size-4" />
          ) : (
            <BookmarkIcon className="size-4" />
          ),
          onClick: () => handleTagClick(bookmark.tag),
          ariaChecked: isSelected,
        });
      }
    }

    return items;
  }, [bookmarks, tags, localize, handleTagClick, handleClear]);

  return (
    <DropdownPopup
      portal={true}
      menuId={menuId}
      focusLoop={true}
      isOpen={isMenuOpen}
      unmountOnHide={true}
      setIsOpen={setIsMenuOpen}
      keyPrefix="bookmark-nav-"
      className={isTourPreview ? 'z-[1001]' : 'z-[125]'}
      trigger={
        <TooltipAnchor
          description={localize('com_nav_tooltip_bookmarks')}
          render={
            <Ariakit.MenuButton
              id="bookmark-nav-menu-button"
              aria-label={buttonAriaLabel}
              aria-pressed={tags.length > 0}
              data-tour-id="nav-bookmarks"
              data-tour-clip="sidebar"
              data-tour-padding="-4"
              data-tour-offset-x="0"
              data-tour-offset-y="-1"
              data-tour-radius="18"
              className={cn(
                'sidebar-toolbar-button flex size-10 items-center justify-center rounded-xl p-2',
                'border-none text-text-primary hover:bg-surface-active-alt',
                'outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black dark:focus-visible:ring-white',
                isMenuOpen ? 'border-border-light bg-surface-hover' : '',
              )}
              data-testid="bookmark-menu"
            >
              {tags.length > 0 ? (
                <BookmarkCheck aria-hidden="true" className="sidebar-toolbar-symbol" />
              ) : (
                <Bookmark aria-hidden="true" className="sidebar-toolbar-symbol" />
              )}
            </Ariakit.MenuButton>
          }
        />
      }
      items={dropdownItems}
    />
  );
};

export default BookmarkNav;
