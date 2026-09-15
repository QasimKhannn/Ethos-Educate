import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Folder, FolderPlus, LibraryBig } from 'lucide-react';
import { TooltipAnchor } from '@librechat/client';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { TProject } from 'librechat-data-provider';
import {
  createMockNavigationDraftConversationId,
  getMockNavigationProjects,
  isMockNavigationUser,
} from '~/components/Nav/mockNavigation';
import type { MockProjectAccent } from '~/components/Nav/mockNavigation';
import { useProjectsQuery } from '~/data-provider';
import { useAuthContext, useLocalize, useLocalStorage, useNewConvo } from '~/hooks';
import { cn } from '~/utils';
import store from '~/store';
import type { ProjectConversation } from './ProjectChatsPanel';
import type { ProjectLibraryItem } from './ProjectsLibraryDialog';
import ProjectCreateDialog from './ProjectCreateDialog';
import ProjectChatsPanel from './ProjectChatsPanel';
import ProjectsLibraryDialog from './ProjectsLibraryDialog';
import { rankProjects } from './projectNavigation';

type NavigationProject = {
  accent?: MockProjectAccent;
  demoConversations?: ProjectConversation[];
  isFavorite: boolean;
  lastWorkedAt?: string;
  project: TProject;
};

const sidebarProjectLimit = 4;
const projectMenuGap = 8;
const projectMenuWidth = 296;

const ProjectRow = memo(
  ({
    project,
    active,
    selected,
    accent,
    onOpen,
    onOpenProject,
  }: {
    project: TProject;
    active: boolean;
    selected: boolean;
    accent?: MockProjectAccent;
    onOpen: (trigger: HTMLButtonElement) => void;
    onOpenProject: () => void;
  }) => {
    const localize = useLocalize();
    return (
      <div className="sidebar-project-group">
        <div
          className={cn(
            'sidebar-project-row sidebar-utility-item group flex min-h-9 w-full items-center gap-1 rounded-xl text-sm outline-none transition-colors',
            selected && 'sidebar-project-row-selected',
            selected && 'sidebar-project-row-expanded',
            active || selected
              ? 'sidebar-utility-item-active text-text-primary'
              : 'text-text-primary hover:bg-surface-hover',
          )}
          title={project.name}
        >
          <button
            type="button"
            className="sidebar-project-main-button flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left outline-none"
            onClick={onOpenProject}
            aria-label={localize('com_projects_open_project_name', { name: project.name })}
          >
            <span
              className={cn(
                'sidebar-utility-icon sidebar-project-icon flex flex-shrink-0 items-center justify-center',
                accent && `sidebar-project-icon-${accent}`,
              )}
            >
              <Folder className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1 truncate font-medium">{project.name}</span>
          </button>
          <button
            type="button"
            className="sidebar-project-toggle-button flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg outline-none"
            aria-controls={selected ? `project-chats-panel-${project._id}` : undefined}
            aria-expanded={selected}
            aria-label={localize(
              selected ? 'com_projects_close_project_chats' : 'com_projects_toggle_chats',
              { name: project.name },
            )}
            onClick={(event) => onOpen(event.currentTarget)}
          >
            <ChevronDown
              className={cn(
                'sidebar-project-open-icon h-3.5 w-3.5 flex-shrink-0',
                selected && 'sidebar-project-open-icon-active',
              )}
              aria-hidden="true"
            />
          </button>
        </div>
      </div>
    );
  },
);

ProjectRow.displayName = 'ProjectRow';

type ProjectsNavProps = {
  isSmallScreen?: boolean;
  navVisible?: boolean;
  onDismissNavigation?: () => void;
};

function ProjectsNav({
  isSmallScreen = false,
  navVisible = true,
  onDismissNavigation,
}: ProjectsNavProps) {
  const localize = useLocalize();
  const { user } = useAuthContext();
  const navigate = useNavigate();
  const { newConversation } = useNewConvo();
  const params = useParams();
  const [searchParams] = useSearchParams();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [panelAnchorTop, setPanelAnchorTop] = useState(112);
  const [panelAnchorLeft, setPanelAnchorLeft] = useState(296);
  const projectTriggerRef = useRef<HTMLButtonElement | null>(null);
  const { conversation } = store.useCreateConversationAtom(0);
  const { data: projects = [] } = useProjectsQuery();
  const storageIdentity = user?.username ?? user?.name ?? 'guest';
  const [favoriteProjectIds, setFavoriteProjectIds] = useLocalStorage<string[]>(
    `ethos-project-favorites:${storageIdentity}`,
    [],
  );
  const [projectActivity, setProjectActivity] = useLocalStorage<Record<string, string>>(
    `ethos-project-activity:${storageIdentity}`,
    {},
  );
  const favoriteProjectIdSet = useMemo(() => new Set(favoriteProjectIds), [favoriteProjectIds]);
  const mockNavigationProjects = useMemo<NavigationProject[]>(() => {
    if (!isMockNavigationUser(user)) {
      return [];
    }

    return getMockNavigationProjects(localize).map(
      ({ accent, conversations, isFavorite, lastWorkedAt, project }) => ({
        accent,
        demoConversations: conversations,
        isFavorite,
        lastWorkedAt,
        project,
      }),
    );
  }, [localize, user]);
  const navigationProjects = useMemo<NavigationProject[]>(() => {
    const realProjects = projects.map((project) => ({
      isFavorite: favoriteProjectIdSet.has(project._id),
      lastWorkedAt: projectActivity[project._id] ?? project.updatedAt ?? project.createdAt,
      project,
    }));
    return [...mockNavigationProjects, ...realProjects];
  }, [favoriteProjectIdSet, mockNavigationProjects, projectActivity, projects]);
  const rankedNavigationProjects = useMemo(
    () => rankProjects(navigationProjects),
    [navigationProjects],
  );
  const visibleNavigationProjects = useMemo(
    () => rankedNavigationProjects.slice(0, sidebarProjectLimit),
    [rankedNavigationProjects],
  );
  const libraryProjects = useMemo<ProjectLibraryItem[]>(
    () =>
      rankedNavigationProjects.map(
        ({ accent, demoConversations, isFavorite, lastWorkedAt, project }) => ({
          accent,
          conversationCount: demoConversations?.length ?? project.conversationIds?.length ?? 0,
          isDemo: demoConversations != null,
          isFavorite,
          lastWorkedAt,
          project,
        }),
      ),
    [rankedNavigationProjects],
  );
  const activeProjectId =
    params.projectId || searchParams.get('projectId') || conversation?.projectId || '';
  const activeConversationId = params.conversationId || conversation?.conversationId || '';
  const selectedNavigationProject = useMemo(
    () => rankedNavigationProjects.find(({ project }) => project._id === selectedProjectId),
    [rankedNavigationProjects, selectedProjectId],
  );

  useEffect(() => {
    if (navVisible) {
      return;
    }
    setSelectedProjectId(null);
  }, [navVisible]);

  const markProjectActivity = (projectId: string) => {
    setProjectActivity({
      ...projectActivity,
      [projectId]: new Date().toISOString(),
    });
  };

  const toggleFavoriteProject = (projectId: string) => {
    const nextFavoriteProjectIds = favoriteProjectIdSet.has(projectId)
      ? favoriteProjectIds.filter((favoriteProjectId) => favoriteProjectId !== projectId)
      : [...favoriteProjectIds, projectId];
    setFavoriteProjectIds(nextFavoriteProjectIds);
  };

  const closeProjectPanel = useCallback(() => {
    setSelectedProjectId(null);
    requestAnimationFrame(() => projectTriggerRef.current?.focus());
  }, []);

  const handleProjectClick = (projectId: string, trigger?: HTMLButtonElement) => {
    markProjectActivity(projectId);
    if (selectedProjectId === projectId && trigger) {
      closeProjectPanel();
      return;
    }

    projectTriggerRef.current = trigger ?? null;
    if (trigger && !isSmallScreen) {
      const triggerBounds = trigger.getBoundingClientRect();
      const triggerTop = triggerBounds.top - 8;
      const maximumTop = Math.max(80, window.innerHeight - 384);
      setPanelAnchorTop(Math.min(Math.max(triggerTop, 80), maximumTop));
      const maximumLeft = Math.max(
        projectMenuGap,
        window.innerWidth - projectMenuWidth - projectMenuGap,
      );
      setPanelAnchorLeft(Math.min(triggerBounds.right + projectMenuGap, maximumLeft));
    }
    setSelectedProjectId(projectId);
  };

  const handleOpenProject = (projectId: string) => {
    markProjectActivity(projectId);
    setSelectedProjectId(null);
    navigate(`/projects/${projectId}`);
  };

  const handleNewProjectConversation = (projectId: string, isDemoProject = false) => {
    markProjectActivity(projectId);
    setSelectedProjectId(null);
    if (isSmallScreen) {
      onDismissNavigation?.();
    }
    if (isDemoProject) {
      navigate(
        `/c/${createMockNavigationDraftConversationId()}?projectId=${encodeURIComponent(projectId)}`,
        {
          state: { focusChat: true },
        },
      );
      return;
    }

    newConversation({ template: { projectId } });
  };

  const handleConversationClick = (projectId: string, conversationId: string) => {
    markProjectActivity(projectId);
    setSelectedProjectId(null);
    navigate(`/c/${conversationId}?projectId=${projectId}`, { state: { focusChat: true } });
  };

  return (
    <div className="sidebar-projects-section sidebar-utility-section mt-1 pt-2">
      <div className="sidebar-projects-header flex items-center justify-between px-2 pb-0.5">
        <div>
          <TooltipAnchor
            description={localize('com_ui_tooltip_projects')}
            render={
              <span className="sidebar-section-heading text-xs">
                {localize('com_projects_projects')}
              </span>
            }
          />
        </div>
        <button
          type="button"
          className="sidebar-project-create-inline"
          aria-label={localize('com_projects_new_project')}
          onClick={() => setDialogOpen(true)}
        >
          <FolderPlus className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{localize('com_ui_new')}</span>
        </button>
      </div>
      <div className="sidebar-projects-scroll">
        {visibleNavigationProjects.map(({ project, accent, demoConversations }) => {
          return (
            <ProjectRow
              key={project._id}
              project={project}
              active={activeProjectId === project._id}
              selected={selectedProjectId === project._id}
              accent={accent}
              onOpen={(trigger) => handleProjectClick(project._id, trigger)}
              onOpenProject={() => {
                if (demoConversations != null) {
                  handleProjectClick(project._id);
                  return;
                }
                handleOpenProject(project._id);
              }}
            />
          );
        })}
      </div>
      {rankedNavigationProjects.length > sidebarProjectLimit ? (
        <button
          type="button"
          className="sidebar-projects-view-all"
          onClick={() => setLibraryOpen(true)}
        >
          <LibraryBig className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{localize('com_projects_view_all')}</span>
          <ChevronRight className="ml-auto h-3.5 w-3.5" aria-hidden="true" />
        </button>
      ) : null}
      <ProjectCreateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={(project) => handleOpenProject(project._id)}
      />
      <ProjectsLibraryDialog
        open={libraryOpen}
        projects={libraryProjects}
        onOpenChange={setLibraryOpen}
        onToggleFavorite={toggleFavoriteProject}
        onSelect={(item) => {
          setLibraryOpen(false);
          handleProjectClick(item.project._id);
        }}
      />
      {selectedNavigationProject ? (
        <ProjectChatsPanel
          project={selectedNavigationProject.project}
          demoConversations={selectedNavigationProject.demoConversations}
          activeConversationId={activeConversationId}
          anchorLeft={panelAnchorLeft}
          anchorTop={panelAnchorTop}
          onClose={closeProjectPanel}
          onNewConversation={() =>
            handleNewProjectConversation(
              selectedNavigationProject.project._id,
              selectedNavigationProject.demoConversations != null,
            )
          }
          onConversationClick={(projectConversation) => {
            const conversationId = projectConversation.conversationId;
            if (conversationId) {
              handleConversationClick(selectedNavigationProject.project._id, conversationId);
            }
          }}
        />
      ) : null}
    </div>
  );
}

export default memo(ProjectsNav);
