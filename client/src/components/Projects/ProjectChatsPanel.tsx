import { useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, Folder, MessageSquarePlus, MessageSquareText, X } from 'lucide-react';
import type { TProject } from 'librechat-data-provider';
import { useConversationsInfiniteQuery } from '~/data-provider';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';
import { flattenUniqueConversations } from './utils';

export type ProjectConversation = {
  conversationId?: string | null;
  endpoint?: string | null;
  title?: string | null;
};

type ProjectChatsPanelProps = {
  activeConversationId: string;
  anchorLeft: number;
  anchorTop: number;
  demoConversations?: ProjectConversation[];
  onClose: () => void;
  onConversationClick: (conversation: ProjectConversation) => void;
  onNewConversation?: () => void;
  project: TProject;
};

export default function ProjectChatsPanel({
  activeConversationId,
  anchorLeft,
  anchorTop,
  demoConversations,
  onClose,
  onConversationClick,
  onNewConversation,
  project,
}: ProjectChatsPanelProps) {
  const localize = useLocalize();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const conversationsQuery = useConversationsInfiniteQuery(
    { projectId: project._id },
    { enabled: demoConversations == null },
  );
  const conversations = useMemo<ProjectConversation[]>(
    () => demoConversations ?? flattenUniqueConversations(conversationsQuery.data?.pages),
    [conversationsQuery.data, demoConversations],
  );

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, [project._id]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }
      event.preventDefault();
      onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (typeof document === 'undefined') {
    return null;
  }

  const renderConversations = () => {
    if (demoConversations == null && conversationsQuery.isLoading) {
      return (
        <div className="sidebar-project-menu-status" role="status">
          {localize('com_ui_loading')}
        </div>
      );
    }

    if (conversations.length === 0) {
      return (
        <div className="sidebar-project-menu-status" role="status">
          {localize('com_projects_no_chats')}
        </div>
      );
    }

    return conversations.map((conversation) => {
      const conversationId = conversation.conversationId;
      if (!conversationId) {
        return null;
      }

      const title = conversation.title || localize('com_projects_chat');
      const isActive = activeConversationId === conversationId;
      return (
        <button
          key={conversationId}
          type="button"
          className={cn(
            'sidebar-project-convo-row',
            isActive && 'sidebar-project-convo-row-active',
          )}
          aria-current={isActive ? 'page' : undefined}
          onClick={() => onConversationClick(conversation)}
          title={title}
        >
          <MessageSquareText className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate">{title}</span>
          <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
        </button>
      );
    });
  };

  return createPortal(
    <aside
      id={`project-chats-panel-${project._id}`}
      className="sidebar-project-menu"
      style={{ top: anchorTop, left: anchorLeft }}
      aria-label={localize('com_projects_project_chat_list', { name: project.name })}
    >
      <header className="sidebar-project-menu-header">
        <span className="sidebar-project-menu-folder" aria-hidden="true">
          <Folder className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1 truncate font-semibold">{project.name}</span>
        <button
          ref={closeButtonRef}
          type="button"
          className="sidebar-project-menu-close"
          aria-label={localize('com_projects_close_project_chats', { name: project.name })}
          onClick={onClose}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </header>
      {onNewConversation ? (
        <button
          type="button"
          className="sidebar-project-menu-new-chat"
          aria-label={localize('com_projects_new_chat_in_project', { name: project.name })}
          onClick={onNewConversation}
        >
          <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{localize('com_ui_new_chat')}</span>
        </button>
      ) : null}
      <div className="sidebar-project-menu-list">{renderConversations()}</div>
    </aside>,
    document.body,
  );
}
