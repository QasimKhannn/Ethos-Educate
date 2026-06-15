// cowork — React Query hooks: Cowork projects + per-project workspace.
import { useQuery } from '@tanstack/react-query';
import { QueryKeys, dataService } from 'librechat-data-provider';
import type { QueryObserverResult, UseQueryOptions } from '@tanstack/react-query';
import type { TCoworkProject, TCoworkTreeResponse } from 'librechat-data-provider';

/** List the user's Cowork projects. */
export const useCoworkProjectsQuery = (
  config?: UseQueryOptions<TCoworkProject[]>,
): QueryObserverResult<TCoworkProject[]> => {
  return useQuery<TCoworkProject[]>(
    [QueryKeys.coworkProjects],
    () => dataService.listCoworkProjects(),
    {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 30,
      ...config,
    },
  );
};

/** Fetch the workspace file tree for a Cowork project. */
export const useCoworkTreeQuery = (
  projectId?: string | null,
  config?: UseQueryOptions<TCoworkTreeResponse>,
): QueryObserverResult<TCoworkTreeResponse> => {
  const id = projectId ?? '';
  return useQuery<TCoworkTreeResponse>(
    [QueryKeys.coworkWorkspace, id],
    () => dataService.getCoworkTree(id),
    {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 10,
      ...config,
      enabled: (config?.enabled ?? true) === true && id !== '',
    },
  );
};
