import { memo, useEffect, useMemo, useState } from 'react';
import { ChevronRight, Folder, FolderPlus, MessageSquare } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { TProject } from 'librechat-data-provider';
import { useConversationsInfiniteQuery, useProjectsQuery } from '~/data-provider';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';
import store from '~/store';
import { flattenUniqueConversations } from './utils';
import ProjectCreateDialog from './ProjectCreateDialog';

type ProjectConversation = {
  conversationId?: string | null;
  endpoint?: string | null;
  title?: string | null;
};

const ProjectRow = memo(
  ({
    project,
    active,
    expanded,
    activeConversationId,
    onToggle,
    onProjectClick,
    onConversationClick,
  }: {
    project: TProject;
    active: boolean;
    expanded: boolean;
    activeConversationId: string;
    onToggle: () => void;
    onProjectClick: () => void;
    onConversationClick: (conversationId: string) => void;
  }) => {
    const localize = useLocalize();
    const conversationsQuery = useConversationsInfiniteQuery(
      { projectId: project._id },
      { enabled: expanded },
    );
    const conversations = useMemo<ProjectConversation[]>(
      () => flattenUniqueConversations(conversationsQuery.data?.pages),
      [conversationsQuery.data],
    );

    const renderConversationList = () => {
      if (conversationsQuery.isLoading) {
        return (
          <div className="px-2 py-1.5 text-xs text-text-secondary">
            {localize('com_ui_loading')}
          </div>
        );
      }

      if (conversations.length === 0) {
        return (
          <div className="px-2 py-1.5 text-xs font-medium text-white">
            {localize('com_projects_no_chats')}
          </div>
        );
      }

      return conversations.map((conversation) => {
        const conversationId = conversation.conversationId;
        if (!conversationId) {
          return null;
        }
        const isActive = activeConversationId === conversationId;
        return (
          <button
            key={conversationId}
            type="button"
            className={cn(
              'sidebar-convo-row flex h-8 w-full items-center gap-2 rounded-lg px-2 text-left text-sm outline-none transition-colors',
              isActive
                ? 'sidebar-convo-row-active text-text-primary'
                : 'sidebar-convo-row-idle text-text-secondary hover:text-text-primary',
            )}
            onClick={() => onConversationClick(conversationId)}
          >
            <MessageSquare className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">{conversation.title || localize('com_projects_chat')}</span>
          </button>
        );
      });
    };

    return (
      <div className="space-y-1">
        <div
          className={cn(
            'sidebar-project-row sidebar-utility-item group flex min-h-10 w-full items-center gap-1 rounded-xl text-sm outline-none transition-colors',
            active
              ? 'sidebar-utility-item-active text-text-primary'
              : 'text-text-primary hover:bg-surface-hover',
          )}
        >
          <button
            type="button"
            className="flex h-9 w-8 items-center justify-center rounded-lg text-text-secondary hover:text-text-primary"
            aria-label={localize('com_projects_toggle_chats', { name: project.name })}
            aria-expanded={expanded}
            onClick={onToggle}
          >
            <ChevronRight className={cn('h-4 w-4 transition-transform', expanded && 'rotate-90')} />
          </button>
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-3 self-stretch pr-2 text-left"
            onClick={onProjectClick}
          >
            <Folder className="sidebar-utility-icon h-4 w-4 flex-shrink-0" />
            <span className="truncate font-medium">{project.name}</span>
          </button>
        </div>
        {expanded ? <div className="ml-5 space-y-1 pl-2">{renderConversationList()}</div> : null}
      </div>
    );
  },
);

ProjectRow.displayName = 'ProjectRow';

function ProjectsNav() {
  const localize = useLocalize();
  const navigate = useNavigate();
  const params = useParams();
  const [searchParams] = useSearchParams();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expandedProjectIds, setExpandedProjectIds] = useState<Set<string>>(new Set());
  const { conversation } = store.useCreateConversationAtom(0);
  const { data: projects = [] } = useProjectsQuery();
  const activeProjectId =
    params.projectId || searchParams.get('projectId') || conversation?.projectId || '';
  const activeConversationId = params.conversationId || conversation?.conversationId || '';

  useEffect(() => {
    if (!activeProjectId) {
      return;
    }
    setExpandedProjectIds((current) => {
      if (current.has(activeProjectId)) {
        return current;
      }
      const next = new Set(current);
      next.add(activeProjectId);
      return next;
    });
  }, [activeProjectId]);

  const toggleProject = (projectId: string) => {
    setExpandedProjectIds((current) => {
      const next = new Set(current);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  const handleProjectClick = (projectId: string) => {
    setExpandedProjectIds((current) => {
      if (current.has(projectId)) {
        return current;
      }
      const next = new Set(current);
      next.add(projectId);
      return next;
    });
    navigate(`/projects/${projectId}?tab=chats`);
  };

  const handleConversationClick = (projectId: string, conversationId: string) => {
    navigate(`/c/${conversationId}?projectId=${projectId}`, { state: { focusChat: true } });
  };

  return (
    <div className="sidebar-utility-section mt-1 gap-1.5 pt-2">
      <div className="sidebar-section-heading px-2 pb-0.5 text-xs">
        {localize('com_projects_projects')}
      </div>
      <button
        type="button"
        className="sidebar-project-create-button sidebar-utility-item flex min-h-10 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-text-primary outline-none hover:bg-surface-hover"
        onClick={() => setDialogOpen(true)}
      >
        <FolderPlus className="sidebar-utility-icon h-4 w-4 flex-shrink-0" />
        <span className="font-medium">{localize('com_projects_new_project')}</span>
      </button>
      {projects.map((project) => (
        <ProjectRow
          key={project._id}
          project={project}
          active={activeProjectId === project._id}
          expanded={expandedProjectIds.has(project._id)}
          activeConversationId={activeConversationId}
          onToggle={() => toggleProject(project._id)}
          onProjectClick={() => handleProjectClick(project._id)}
          onConversationClick={(conversationId) =>
            handleConversationClick(project._id, conversationId)
          }
        />
      ))}
      <ProjectCreateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={(project) => handleProjectClick(project._id)}
      />
    </div>
  );
}

export default memo(ProjectsNav);
