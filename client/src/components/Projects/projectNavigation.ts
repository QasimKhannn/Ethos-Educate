import type { TProject } from 'librechat-data-provider';

export type RankableProject = {
  isFavorite: boolean;
  lastWorkedAt?: string;
  project: TProject;
};

const getTimestamp = ({ lastWorkedAt, project }: RankableProject): number => {
  const value = lastWorkedAt ?? project.updatedAt ?? project.createdAt;
  if (!value) {
    return 0;
  }

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

export const rankProjects = <T extends RankableProject>(projects: readonly T[]): T[] =>
  [...projects].sort((first, second) => {
    if (first.isFavorite !== second.isFavorite) {
      return first.isFavorite ? -1 : 1;
    }

    const activityDifference = getTimestamp(second) - getTimestamp(first);
    if (activityDifference !== 0) {
      return activityDifference;
    }

    return first.project.name.localeCompare(second.project.name);
  });
