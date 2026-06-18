// cowork — mutations: Cowork project CRUD + per-project workspace upload/delete.
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { QueryKeys, dataService } from 'librechat-data-provider';
import type { UseMutationResult } from '@tanstack/react-query';
import type { TCoworkProject, TCoworkCheckpoint } from 'librechat-data-provider';

/* projects */

export const useCreateCoworkProjectMutation = (): UseMutationResult<
  TCoworkProject,
  unknown,
  { name: string; description?: string; instructions?: string }
> => {
  const queryClient = useQueryClient();
  return useMutation(['coworkProjectCreate'], {
    mutationFn: (payload: { name: string; description?: string; instructions?: string }) =>
      dataService.createCoworkProject(payload),
    onSuccess: () => {
      queryClient.invalidateQueries([QueryKeys.coworkProjects]);
    },
  });
};

type UpdateProjectPayload = Partial<
  Pick<
    TCoworkProject,
    'name' | 'description' | 'instructions' | 'enabledSkills' | 'enabledConnectors' | 'model' | 'provider'
  >
>;

export const useUpdateCoworkProjectMutation = (
  projectId: string,
): UseMutationResult<TCoworkProject, unknown, UpdateProjectPayload> => {
  const queryClient = useQueryClient();
  return useMutation(['coworkProjectUpdate', projectId], {
    mutationFn: (payload: UpdateProjectPayload) =>
      dataService.updateCoworkProject(projectId, payload),

    // Optimistically apply the change so the UI reflects it immediately.
    onMutate: async (payload: UpdateProjectPayload) => {
      await queryClient.cancelQueries([QueryKeys.coworkProjects]);
      const previous = queryClient.getQueryData<TCoworkProject[]>([QueryKeys.coworkProjects]);
      queryClient.setQueryData<TCoworkProject[]>(
        [QueryKeys.coworkProjects],
        (old = []) =>
          old.map((p) => (p._id === projectId ? { ...p, ...payload } : p)),
      );
      return { previous };
    },

    // On success, write the server's authoritative response directly into the
    // cache — avoids a follow-up GET that could flash stale data.
    onSuccess: (updatedProject: TCoworkProject) => {
      queryClient.setQueryData<TCoworkProject[]>(
        [QueryKeys.coworkProjects],
        (old = []) => old.map((p) => (p._id === projectId ? updatedProject : p)),
      );
    },

    // Roll back on server error.
    onError: (_err, _payload, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData([QueryKeys.coworkProjects], context.previous);
      }
    },
  });
};

export const useDeleteCoworkProjectMutation = (): UseMutationResult<
  { deleted: string },
  unknown,
  string
> => {
  const queryClient = useQueryClient();
  return useMutation(['coworkProjectDelete'], {
    mutationFn: (projectId: string) => dataService.deleteCoworkProject(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries([QueryKeys.coworkProjects]);
    },
  });
};

/** Remove a conversation from a Cowork project with optimistic UI removal. */
export const useDeleteCoworkConversationMutation = (
  projectId: string,
): UseMutationResult<{ deleted: string }, unknown, string> => {
  const queryClient = useQueryClient();
  return useMutation(['coworkConversationDelete', projectId], {
    mutationFn: (conversationId: string) =>
      dataService.deleteCoworkConversation(projectId, conversationId),

    // Optimistically remove the entry before the server confirms.
    onMutate: async (conversationId: string) => {
      await queryClient.cancelQueries([QueryKeys.coworkConversations, projectId]);
      const previous = queryClient.getQueryData<unknown[]>([
        QueryKeys.coworkConversations,
        projectId,
      ]);
      queryClient.setQueryData<unknown[]>(
        [QueryKeys.coworkConversations, projectId],
        (old = []) =>
          old.filter(
            (c: unknown) =>
              (c as { conversationId: string }).conversationId !== conversationId,
          ),
      );
      return { previous };
    },

    // Roll back on error.
    onError: (_err, _conversationId, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData([QueryKeys.coworkConversations, projectId], context.previous);
      }
    },

    // Always reconcile with server state after settle.
    onSettled: () => {
      queryClient.invalidateQueries([QueryKeys.coworkConversations, projectId]);
    },
  });
};

/* edit review — apply / discard staged changes, restore checkpoints */

/** After staged changes change, refresh the changes list, file tree, and checkpoints. */
const invalidateEditReview = (
  queryClient: ReturnType<typeof useQueryClient>,
  projectId: string,
) => {
  queryClient.invalidateQueries([QueryKeys.coworkChanges, projectId]);
  queryClient.invalidateQueries([QueryKeys.coworkWorkspace, projectId]);
  queryClient.invalidateQueries([QueryKeys.coworkCheckpoints, projectId]);
};

/** Apply staged changes (all when paths omitted, or a subset), creating a checkpoint. */
export const useApplyCoworkChangesMutation = (
  projectId: string,
): UseMutationResult<TCoworkCheckpoint, unknown, { paths?: string[]; message?: string }> => {
  const queryClient = useQueryClient();
  return useMutation(['coworkChangesApply', projectId], {
    mutationFn: (payload: { paths?: string[]; message?: string }) =>
      dataService.applyCoworkChanges(projectId, payload),
    onSuccess: () => invalidateEditReview(queryClient, projectId),
  });
};

/** Discard one staged change (by path) or all staged changes (omit path). */
export const useDiscardCoworkChangeMutation = (
  projectId: string,
): UseMutationResult<{ discarded: string }, unknown, string | undefined> => {
  const queryClient = useQueryClient();
  return useMutation(['coworkChangeDiscard', projectId], {
    mutationFn: (filePath?: string) => dataService.discardCoworkChange(projectId, filePath),
    onSuccess: () => {
      queryClient.invalidateQueries([QueryKeys.coworkChanges, projectId]);
    },
  });
};

/** Restore (undo) a checkpoint. */
export const useRestoreCoworkCheckpointMutation = (
  projectId: string,
): UseMutationResult<TCoworkCheckpoint, unknown, string> => {
  const queryClient = useQueryClient();
  return useMutation(['coworkCheckpointRestore', projectId], {
    mutationFn: (checkpointId: string) =>
      dataService.restoreCoworkCheckpoint(projectId, checkpointId),
    onSuccess: () => invalidateEditReview(queryClient, projectId),
  });
};

/* project memory */

/** Replace a project's core memory (manual edit). */
export const useUpdateCoworkMemoryMutation = (
  projectId: string,
): UseMutationResult<{ memory: string; overBudget: boolean }, unknown, string> => {
  const queryClient = useQueryClient();
  return useMutation(['coworkMemoryUpdate', projectId], {
    mutationFn: (memory: string) => dataService.updateCoworkMemory(projectId, memory),
    onSuccess: () => {
      queryClient.invalidateQueries([QueryKeys.coworkMemory, projectId]);
    },
  });
};

/* connectors */

/** Save per-teacher API-key credentials for a connector. */
export const useSaveCoworkConnectorCredentialsMutation = (): UseMutationResult<
  { connected: boolean },
  unknown,
  { connectorId: string; fields: Record<string, string> }
> => {
  const queryClient = useQueryClient();
  return useMutation(['coworkConnectorCredentialsSave'], {
    mutationFn: ({ connectorId, fields }: { connectorId: string; fields: Record<string, string> }) =>
      dataService.saveCoworkConnectorCredentials(connectorId, fields),
    onSuccess: () => {
      queryClient.invalidateQueries([QueryKeys.coworkConnectors]);
    },
  });
};

/** Disconnect a connector (remove this user's stored credentials). */
export const useDeleteCoworkConnectorCredentialsMutation = (): UseMutationResult<
  { connected: boolean },
  unknown,
  string
> => {
  const queryClient = useQueryClient();
  return useMutation(['coworkConnectorCredentialsDelete'], {
    mutationFn: (connectorId: string) => dataService.deleteCoworkConnectorCredentials(connectorId),
    onSuccess: () => {
      queryClient.invalidateQueries([QueryKeys.coworkConnectors]);
    },
  });
};

/* workspace */

type CoworkUploadFile = { file: File; relativePath?: string };
type UploadVars = {
  files: CoworkUploadFile[];
  subdir?: string;
  /** Reports cumulative files sent vs. total, after each batch — drives the progress label. */
  onProgress?: (sent: number, total: number) => void;
};

// Large folder uploads are sent in sequential batches instead of one giant request,
// so the browser stays responsive, server memory is bounded, and a failure only loses
// the current batch (earlier batches are already persisted). Whichever cap is hit first
// closes a batch.
const UPLOAD_BATCH_MAX_FILES = 200;
const UPLOAD_BATCH_MAX_BYTES = 50 * 1024 * 1024;

/** Group files into batches bounded by file count and cumulative byte size. */
const toUploadBatches = (files: CoworkUploadFile[]): CoworkUploadFile[][] => {
  const batches: CoworkUploadFile[][] = [];
  let current: CoworkUploadFile[] = [];
  let currentBytes = 0;
  for (const item of files) {
    const size = item.file.size || 0;
    const wouldOverflow =
      current.length >= UPLOAD_BATCH_MAX_FILES || currentBytes + size > UPLOAD_BATCH_MAX_BYTES;
    if (current.length > 0 && wouldOverflow) {
      batches.push(current);
      current = [];
      currentBytes = 0;
    }
    current.push(item);
    currentBytes += size;
  }
  if (current.length > 0) {
    batches.push(current);
  }
  return batches;
};

/** Upload one or many files (folder uploads carry relativePath per file), chunked. */
export const useUploadCoworkFilesMutation = (
  projectId: string,
): UseMutationResult<{ uploaded: number; paths: string[] }, unknown, UploadVars> => {
  const queryClient = useQueryClient();
  return useMutation(['coworkUpload', projectId], {
    mutationFn: async ({ files, subdir, onProgress }: UploadVars) => {
      const batches = toUploadBatches(files);
      const paths: string[] = [];
      let uploaded = 0;
      let sent = 0;
      onProgress?.(0, files.length);
      for (const batch of batches) {
        const formData = new FormData();
        const relativePaths: string[] = [];
        for (const { file, relativePath } of batch) {
          formData.append('files', file);
          relativePaths.push(relativePath || file.name);
        }
        formData.append('relativePaths', JSON.stringify(relativePaths));
        const result = await dataService.uploadCoworkFiles(projectId, formData, subdir);
        uploaded += result.uploaded ?? 0;
        if (Array.isArray(result.paths)) {
          paths.push(...result.paths);
        }
        sent += batch.length;
        onProgress?.(sent, files.length);
      }
      return { uploaded, paths };
    },
    onSettled: () => {
      queryClient.invalidateQueries([QueryKeys.coworkWorkspace, projectId]);
    },
  });
};

export const useDeleteCoworkFileMutation = (
  projectId: string,
): UseMutationResult<{ deleted: string }, unknown, string> => {
  const queryClient = useQueryClient();
  return useMutation(['coworkDelete', projectId], {
    mutationFn: (filePath: string) => dataService.deleteCoworkFile(projectId, filePath),
    onSuccess: () => {
      queryClient.invalidateQueries([QueryKeys.coworkWorkspace, projectId]);
    },
  });
};
