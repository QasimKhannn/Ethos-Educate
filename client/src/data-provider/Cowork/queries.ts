// cowork — React Query hooks: Cowork projects + per-project workspace.
import { useQuery } from '@tanstack/react-query';
import { QueryKeys, dataService, request } from 'librechat-data-provider';
import type { QueryObserverResult, UseQueryOptions } from '@tanstack/react-query';
import type {
  TCoworkProject,
  TCoworkTreeResponse,
  TCoworkConversation,
  TCoworkSkill,
  TCoworkChange,
  TCoworkDiff,
  TCoworkCheckpoint,
  TCoworkConnector,
  TCoworkRoutine,
  TCoworkRoutineRun,
} from 'librechat-data-provider';

/** Whether the current user may use Cowork (admin-managed access policy). */
export const useCoworkAccessQuery = (
  config?: UseQueryOptions<{ allowed: boolean; enabled: boolean; mode: string }>,
): QueryObserverResult<{ allowed: boolean; enabled: boolean; mode: string }> => {
  return useQuery<{ allowed: boolean; enabled: boolean; mode: string }>(
    ['coworkAccess'],
    () => request.get('/api/cowork/access'),
    {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60,
      ...config,
    },
  );
};

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

/** List available builtin skills for a project with enabled flags. */
export const useCoworkSkillsQuery = (
  projectId?: string | null,
  config?: UseQueryOptions<TCoworkSkill[]>,
): QueryObserverResult<TCoworkSkill[]> => {
  const id = projectId ?? '';
  return useQuery<TCoworkSkill[]>(
    [QueryKeys.coworkSkills, id],
    () => dataService.listCoworkSkills(id),
    {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60,
      ...config,
      enabled: (config?.enabled ?? true) === true && id !== '',
    },
  );
};

/** List a project's staged proposed edits (the Changes panel). */
export const useCoworkChangesQuery = (
  projectId?: string | null,
  config?: UseQueryOptions<TCoworkChange[]>,
): QueryObserverResult<TCoworkChange[]> => {
  const id = projectId ?? '';
  return useQuery<TCoworkChange[]>(
    [QueryKeys.coworkChanges, id],
    () => dataService.listCoworkChanges(id),
    {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 5,
      ...config,
      enabled: (config?.enabled ?? true) === true && id !== '',
    },
  );
};

/** Fetch the diff payload for one staged change (lazy — enabled when a path is set). */
export const useCoworkChangeDiffQuery = (
  projectId?: string | null,
  filePath?: string | null,
  config?: UseQueryOptions<TCoworkDiff>,
): QueryObserverResult<TCoworkDiff> => {
  const id = projectId ?? '';
  const path = filePath ?? '';
  return useQuery<TCoworkDiff>(
    [QueryKeys.coworkChanges, id, 'diff', path],
    () => dataService.getCoworkChangeDiff(id, path),
    {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 5,
      ...config,
      enabled: (config?.enabled ?? true) === true && id !== '' && path !== '',
    },
  );
};

/** List a project's undo checkpoints (newest first). */
export const useCoworkCheckpointsQuery = (
  projectId?: string | null,
  config?: UseQueryOptions<TCoworkCheckpoint[]>,
): QueryObserverResult<TCoworkCheckpoint[]> => {
  const id = projectId ?? '';
  return useQuery<TCoworkCheckpoint[]>(
    [QueryKeys.coworkCheckpoints, id],
    () => dataService.listCoworkCheckpoints(id),
    {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 5,
      ...config,
      enabled: (config?.enabled ?? true) === true && id !== '',
    },
  );
};

/** List the connector catalog with the current user's connection status. */
export const useCoworkConnectorsQuery = (
  config?: UseQueryOptions<TCoworkConnector[]>,
): QueryObserverResult<TCoworkConnector[]> => {
  return useQuery<TCoworkConnector[]>(
    [QueryKeys.coworkConnectors],
    () => dataService.getCoworkConnectors(),
    {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 30,
      ...config,
    },
  );
};

/** Read a project's always-injected core memory. */
export const useCoworkMemoryQuery = (
  projectId?: string | null,
  config?: UseQueryOptions<{ memory: string }>,
): QueryObserverResult<{ memory: string }> => {
  const id = projectId ?? '';
  return useQuery<{ memory: string }>(
    [QueryKeys.coworkMemory, id],
    () => dataService.getCoworkMemory(id),
    {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 5,
      ...config,
      enabled: (config?.enabled ?? true) === true && id !== '',
    },
  );
};

/** Read a project's on-demand memory archive (lazy — enable when opened). */
export const useCoworkMemoryArchiveQuery = (
  projectId?: string | null,
  config?: UseQueryOptions<{ archive: string }>,
): QueryObserverResult<{ archive: string }> => {
  const id = projectId ?? '';
  return useQuery<{ archive: string }>(
    [QueryKeys.coworkMemory, id, 'archive'],
    () => dataService.getCoworkMemoryArchive(id),
    {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 5,
      ...config,
      enabled: (config?.enabled ?? true) === true && id !== '',
    },
  );
};

/** List a project's scheduled routines (newest first). */
export const useCoworkRoutinesQuery = (
  projectId?: string | null,
  config?: UseQueryOptions<TCoworkRoutine[]>,
): QueryObserverResult<TCoworkRoutine[]> => {
  const id = projectId ?? '';
  return useQuery<TCoworkRoutine[]>(
    [QueryKeys.coworkRoutines, id],
    () => dataService.listCoworkRoutines(id),
    {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 10,
      ...config,
      enabled: (config?.enabled ?? true) === true && id !== '',
    },
  );
};

/** List a routine's run history (newest first). Enabled only when a routineId is provided. */
export const useCoworkRoutineRunsQuery = (
  routineId?: string | null,
  config?: UseQueryOptions<TCoworkRoutineRun[]>,
): QueryObserverResult<TCoworkRoutineRun[]> => {
  const id = routineId ?? '';
  return useQuery<TCoworkRoutineRun[]>(
    [QueryKeys.coworkRoutineRuns, id],
    () => dataService.listCoworkRoutineRuns(id),
    {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 10,
      ...config,
      enabled: (config?.enabled ?? true) === true && id !== '',
    },
  );
};

/** List a project's conversations (titles + recency) for the history picker. */
export const useCoworkConversationsQuery = (
  projectId?: string | null,
  config?: UseQueryOptions<TCoworkConversation[]>,
): QueryObserverResult<TCoworkConversation[]> => {
  const id = projectId ?? '';
  return useQuery<TCoworkConversation[]>(
    [QueryKeys.coworkConversations, id],
    () => dataService.listCoworkConversations(id).then((r) => r.conversations),
    {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 10,
      ...config,
      enabled: (config?.enabled ?? true) === true && id !== '',
    },
  );
};
