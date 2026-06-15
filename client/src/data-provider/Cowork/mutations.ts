// cowork — mutations: Cowork project CRUD + per-project workspace upload/delete.
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { QueryKeys, dataService } from 'librechat-data-provider';
import type { UseMutationResult } from '@tanstack/react-query';
import type { TCoworkProject } from 'librechat-data-provider';

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

export const useUpdateCoworkProjectMutation = (
  projectId: string,
): UseMutationResult<
  TCoworkProject,
  unknown,
  Partial<Pick<TCoworkProject, 'name' | 'description' | 'instructions' | 'enabledSkills'>>
> => {
  const queryClient = useQueryClient();
  return useMutation(['coworkProjectUpdate', projectId], {
    mutationFn: (
      payload: Partial<
        Pick<TCoworkProject, 'name' | 'description' | 'instructions' | 'enabledSkills'>
      >,
    ) => dataService.updateCoworkProject(projectId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries([QueryKeys.coworkProjects]);
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

/* workspace */

type UploadVars = { files: { file: File; relativePath?: string }[]; subdir?: string };

/** Upload one or many files (folder uploads carry relativePath per file). */
export const useUploadCoworkFilesMutation = (
  projectId: string,
): UseMutationResult<{ uploaded: number; paths: string[] }, unknown, UploadVars> => {
  const queryClient = useQueryClient();
  return useMutation(['coworkUpload', projectId], {
    mutationFn: ({ files, subdir }: UploadVars) => {
      const formData = new FormData();
      const relativePaths: string[] = [];
      for (const { file, relativePath } of files) {
        formData.append('files', file);
        relativePaths.push(relativePath || file.name);
      }
      formData.append('relativePaths', JSON.stringify(relativePaths));
      return dataService.uploadCoworkFiles(projectId, formData, subdir);
    },
    onSuccess: () => {
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
