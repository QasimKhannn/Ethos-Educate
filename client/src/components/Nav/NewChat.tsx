import React, { useCallback } from 'react';
import { PanelLeftClose, SquarePen } from 'lucide-react';
import { Link } from 'react-router-dom';
import { QueryKeys } from 'librechat-data-provider';
import { useQueryClient } from '@tanstack/react-query';
import { TooltipAnchor, Button } from '@librechat/client';
import { CLOSE_SIDEBAR_ID, OPEN_SIDEBAR_ID } from '~/components/Chat/Menus/OpenSidebar';
import { SIDEBAR_FOCUS_DELAY_MS } from '~/components/Nav/sidebarMotion';
import { useLocalize, useNewConvo } from '~/hooks';
import { clearMessagesCache } from '~/utils';
import store from '~/store';

export default function NewChat({
  index = 0,
  toggleNav,
  subHeaders,
  headerButtons,
}: {
  index?: number;
  toggleNav: () => void;
  subHeaders?: React.ReactNode;
  headerButtons?: React.ReactNode;
}) {
  const queryClient = useQueryClient();
  /** Note: this component needs an explicit index passed if using more than one */
  const { newConversation: newConvo } = useNewConvo(index);
  const localize = useLocalize();
  const { conversation } = store.useCreateConversationAtom(index);

  const handleToggleNav = useCallback(() => {
    toggleNav();
    setTimeout(() => {
      document.getElementById(OPEN_SIDEBAR_ID)?.focus();
    }, SIDEBAR_FOCUS_DELAY_MS);
  }, [toggleNav]);

  const clickHandler: React.MouseEventHandler<HTMLAnchorElement> = useCallback(
    (e) => {
      // Let browser handle modified/non-left clicks (new tab, context menu, etc.)
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return;
      }

      e.preventDefault();
      clearMessagesCache(queryClient, conversation?.conversationId);
      queryClient.invalidateQueries([QueryKeys.messages]);
      newConvo();
    },
    [queryClient, conversation, newConvo],
  );

  return (
    <div className="chat-sidebar-top">
      <div className="sidebar-toolbar flex items-center justify-between px-0.5 py-1.5 md:py-1">
        <TooltipAnchor
          description={localize('com_nav_close_sidebar')}
          render={
            <Button
              id={CLOSE_SIDEBAR_ID}
              size="icon"
              variant="ghost"
              data-testid="close-sidebar-button"
              aria-label={localize('com_nav_close_sidebar')}
              aria-expanded={true}
              className="sidebar-toolbar-button"
              onClick={handleToggleNav}
            >
              <PanelLeftClose aria-hidden="true" className="sidebar-nav-toggle-icon" />
            </Button>
          }
        />
        <div className="sidebar-toolbar-actions flex gap-1">
          {headerButtons}
          <TooltipAnchor
            description={localize('com_ui_new_chat')}
            render={
              <Button
                asChild
                size="icon"
                variant="ghost"
                data-testid="nav-new-chat-button"
                data-tour-id="nav-new-chat"
                data-tour-clip="sidebar"
                data-tour-padding="-4"
                data-tour-offset-x="0"
                data-tour-offset-y="-1"
                data-tour-radius="18"
                aria-label={localize('com_ui_new_chat')}
                className="sidebar-toolbar-button"
              >
                <Link to="/c/new" state={{ focusChat: true }} onClick={clickHandler}>
                  <SquarePen aria-hidden="true" className="sidebar-toolbar-symbol" />
                </Link>
              </Button>
            }
          />
        </div>
      </div>
      {subHeaders != null ? subHeaders : null}
    </div>
  );
}
