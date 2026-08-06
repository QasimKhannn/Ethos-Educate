import { useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, ChevronLeft, ChevronRight, Folder, MessageSquareText, X } from 'lucide-react';
import type { TProject } from 'librechat-data-provider';
import type { MockProjectAccent } from '~/components/Nav/mockNavigation';
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
  accent?: MockProjectAccent;
  activeConversationId: string;
  anchorTop: number;
  demoConversations?: ProjectConversation[];
  isMobile: boolean;
  onClose: () => void;
  onConversationClick: (conversation: ProjectConversation) => void;
  onDismissNavigation: () => void;
  onOpenProject?: () => void;
  project: TProject;
};

export default function ProjectChatsPanel({
  accent,
  activeConversationId,
  anchorTop,
  demoConversations,
  isMobile,
  onClose,
  onConversationClick,
  onDismissNavigation,
  onOpenProject,
  project,
}: ProjectChatsPanelProps) {
  const localize = useLocalize();
  const initialFocusRef = useRef<HTMLButtonElement>(null);
  const conversationsQuery = useConversationsInfiniteQuery(
    { projectId: project._id },
    { enabled: demoConversations == null },
  );
  const conversations = useMemo<ProjectConversation[]>(
    () => demoConversations ?? flattenUniqueConversations(conversationsQuery.data?.pages),
    [conversationsQuery.data, demoConversations],
  );
  const conversationCount =
    demoConversations?.length ?? project.conversationIds?.length ?? conversations.length;
  const conversationCountLabel = localize(
    conversationCount === 1 ? 'com_projects_chat_count_one' : 'com_projects_chat_count_other',
    { count: conversationCount },
  );
  const panelId = `project-chats-panel-${project._id}`;

  useEffect(() => {
    initialFocusRef.current?.focus();
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
        <div className="sidebar-project-panel-status" role="status">
          {localize('com_ui_loading')}
        </div>
      );
    }

    if (conversations.length === 0) {
      return (
        <div className="sidebar-project-panel-empty" role="status">
          <MessageSquareText className="h-5 w-5" aria-hidden="true" />
          <span>{localize('com_projects_no_chats')}</span>
          <p>{localize('com_projects_no_chats_description', { name: project.name })}</p>
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
            'sidebar-project-panel-chat',
            isActive && 'sidebar-project-panel-chat-active',
          )}
          aria-current={isActive ? 'page' : undefined}
          onClick={() => onConversationClick(conversation)}
          title={title}
        >
          <span className="sidebar-project-panel-chat-icon" aria-hidden="true">
            <MessageSquareText className="h-4 w-4" />
          </span>
          <span className="truncate">{title}</span>
          <ChevronRight
            className="sidebar-project-panel-chat-arrow h-3.5 w-3.5"
            aria-hidden="true"
          />
        </button>
      );
    });
  };

  return createPortal(
    <aside
      id={panelId}
      className={cn(
        'sidebar-project-panel',
        isMobile ? 'sidebar-project-panel-mobile' : 'sidebar-project-panel-desktop',
      )}
      style={isMobile ? undefined : { top: anchorTop }}
      aria-label={localize('com_projects_project_chat_list', { name: project.name })}
    >
      <header className="sidebar-project-panel-header">
        {isMobile ? (
          <button
            ref={initialFocusRef}
            type="button"
            className="sidebar-project-panel-back"
            aria-label={localize('com_projects_back_to_projects')}
            onClick={onClose}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}
        <span
          className={cn(
            'sidebar-project-panel-folder',
            accent && `sidebar-project-panel-folder-${accent}`,
          )}
          aria-hidden="true"
        >
          <Folder className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <span className="sidebar-project-panel-eyebrow">{localize('com_projects_chats')}</span>
          <h2 className="sidebar-project-panel-title">{project.name}</h2>
          <p className="sidebar-project-panel-count">{conversationCountLabel}</p>
        </div>
        <button
          ref={isMobile ? undefined : initialFocusRef}
          type="button"
          className="sidebar-project-panel-close"
          aria-label={
            isMobile
              ? localize('com_nav_close_sidebar')
              : localize('com_projects_close_project_chats', { name: project.name })
          }
          onClick={isMobile ? onDismissNavigation : onClose}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </header>
      {onOpenProject ? (
        <div className="sidebar-project-panel-actions">
          <button
            type="button"
            className="sidebar-project-panel-open-project"
            aria-label={localize('com_projects_open_project_name', { name: project.name })}
            onClick={onOpenProject}
          >
            <span>{localize('com_projects_open_project')}</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}
      <div className="sidebar-project-panel-list">{renderConversations()}</div>
    </aside>,
    document.body,
  );
}
