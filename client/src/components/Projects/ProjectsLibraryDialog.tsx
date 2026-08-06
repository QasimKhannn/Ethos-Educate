import { useEffect, useMemo, useState } from 'react';
import { Folder, Search, Star, X } from 'lucide-react';
import { OGDialog, OGDialogContent, OGDialogTitle } from '@librechat/client';
import type { TProject } from 'librechat-data-provider';
import type { MockProjectAccent } from '~/components/Nav/mockNavigation';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';

export type ProjectLibraryItem = {
  accent?: MockProjectAccent;
  conversationCount: number;
  isDemo: boolean;
  isFavorite: boolean;
  lastWorkedAt?: string;
  project: TProject;
};

type ProjectsLibraryDialogProps = {
  onOpenChange: (open: boolean) => void;
  onSelect: (item: ProjectLibraryItem) => void;
  onToggleFavorite: (projectId: string) => void;
  open: boolean;
  projects: ProjectLibraryItem[];
};

const formatActivityDate = (value?: string): string | null => {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
  }).format(date);
};

export default function ProjectsLibraryDialog({
  onOpenChange,
  onSelect,
  onToggleFavorite,
  open,
  projects,
}: ProjectsLibraryDialogProps) {
  const localize = useLocalize();
  const [searchTerm, setSearchTerm] = useState('');
  const filteredProjects = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLocaleLowerCase();
    if (!normalizedSearch) {
      return projects;
    }

    return projects.filter(({ project }) =>
      project.name.toLocaleLowerCase().includes(normalizedSearch),
    );
  }, [projects, searchTerm]);

  useEffect(() => {
    if (!open) {
      setSearchTerm('');
    }
  }, [open]);

  return (
    <OGDialog open={open} onOpenChange={onOpenChange}>
      <OGDialogContent
        showCloseButton={false}
        className="project-library-dialog w-[min(92vw,38rem)] overflow-hidden rounded-[1.35rem] p-0"
      >
        <div className="project-library-header">
          <div className="min-w-0">
            <OGDialogTitle className="project-library-title">
              {localize('com_projects_all_projects')}
            </OGDialogTitle>
            <p className="project-library-description">
              {localize('com_projects_all_projects_description')}
            </p>
          </div>
          <button
            type="button"
            className="project-library-close"
            aria-label={localize('com_ui_close')}
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <label className="project-library-search">
          <Search className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">{localize('com_projects_search_placeholder')}</span>
          <input
            value={searchTerm}
            placeholder={localize('com_projects_search_placeholder')}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </label>

        <div className="project-library-list" role="list">
          {filteredProjects.length === 0 ? (
            <div className="project-library-empty" role="status">
              {localize('com_projects_no_matches')}
            </div>
          ) : (
            filteredProjects.map((item) => {
              const { accent, conversationCount, isFavorite, lastWorkedAt, project } = item;
              const activityDate = formatActivityDate(lastWorkedAt ?? project.updatedAt);
              const conversationLabel = localize(
                conversationCount === 1
                  ? 'com_projects_chat_count_one'
                  : 'com_projects_chat_count_other',
                { count: conversationCount },
              );
              let activityLabel: string | null = null;
              if (isFavorite) {
                activityLabel = localize('com_projects_favorite');
              } else if (activityDate) {
                activityLabel = localize('com_projects_worked_on', { date: activityDate });
              }

              return (
                <div key={project._id} className="project-library-row" role="listitem">
                  <button
                    type="button"
                    className="project-library-project-button"
                    onClick={() => onSelect(item)}
                  >
                    <span
                      className={cn(
                        'project-library-icon',
                        accent && `project-library-icon-${accent}`,
                      )}
                    >
                      <Folder className="h-5 w-5" />
                    </span>
                    <span className="project-library-project-copy">
                      <span className="project-library-project-name">{project.name}</span>
                      <span className="project-library-project-meta">
                        {activityLabel ? (
                          <span className={cn(isFavorite && 'project-library-favorite-label')}>
                            {isFavorite ? (
                              <Star className="h-3 w-3 fill-current" aria-hidden="true" />
                            ) : null}
                            {activityLabel}
                          </span>
                        ) : null}
                        <span>{conversationLabel}</span>
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className={cn(
                      'project-library-favorite-button',
                      isFavorite && 'project-library-favorite-button-active',
                    )}
                    aria-label={localize(
                      isFavorite
                        ? 'com_projects_unfavorite_project'
                        : 'com_projects_favorite_project',
                      { name: project.name },
                    )}
                    aria-pressed={isFavorite}
                    onClick={() => onToggleFavorite(project._id)}
                  >
                    <Star className={cn('h-4 w-4', isFavorite && 'fill-current')} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </OGDialogContent>
    </OGDialog>
  );
}
