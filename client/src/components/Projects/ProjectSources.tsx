import { useRef, useState } from 'react';
import { v4 } from 'uuid';
import { FileText, Paperclip, Trash2, UploadCloud } from 'lucide-react';
import { Button, Spinner, useToastContext } from '@librechat/client';
import { EToolResources } from 'librechat-data-provider';
import type { TProjectFile } from 'librechat-data-provider';
import {
  useUploadFileMutation,
  useProjectFilesQuery,
  useAddProjectFilesMutation,
  useRemoveProjectFileMutation,
} from '~/data-provider';
import { useLocalize } from '~/hooks';

const formatBytes = (bytes?: number) => {
  if (!bytes) {
    return '';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default function ProjectSources({ projectId }: { projectId: string }) {
  const localize = useLocalize();
  const inputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToastContext();
  const [isUploading, setIsUploading] = useState(false);
  const { data: files = [], isLoading } = useProjectFilesQuery(projectId);
  const uploadFile = useUploadFileMutation();
  const addProjectFiles = useAddProjectFilesMutation();
  const removeProjectFile = useRemoveProjectFileMutation();

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) {
      return;
    }

    setIsUploading(true);
    try {
      const uploadedIds: string[] = [];
      for (const file of Array.from(fileList)) {
        const fileId = v4();
        const formData = new FormData();
        formData.append('endpoint', 'default');
        formData.append('endpointType', '');
        formData.append('file', file, encodeURIComponent(file.name));
        formData.append('file_id', fileId);
        formData.append('message_file', 'true');
        formData.append('tool_resource', EToolResources.context);
        const uploaded = await uploadFile.mutateAsync(formData);
        uploadedIds.push(uploaded.file_id);
      }

      if (uploadedIds.length > 0) {
        await addProjectFiles.mutateAsync({ projectId, fileIds: uploadedIds });
      }
      showToast({
        message: localize('com_projects_sources_uploaded'),
        status: 'success',
      });
    } catch {
      showToast({
        message: localize('com_projects_sources_upload_failed'),
        status: 'error',
      });
    } finally {
      setIsUploading(false);
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  };

  const removeFile = (file: TProjectFile) => {
    removeProjectFile.mutate({ projectId, fileId: file.file_id });
  };

  return (
    <div className="w-full max-w-5xl space-y-5">
      <div
        className="flex min-h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed border-border-light bg-surface-primary px-6 text-center"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          handleFiles(event.dataTransfer.files);
        }}
      >
        <div className="mb-5 flex -space-x-2">
          <div className="rounded-xl border border-border-light bg-surface-secondary p-3">
            <Paperclip className="h-5 w-5" />
          </div>
          <div className="rounded-xl border border-border-light bg-surface-secondary p-3">
            <UploadCloud className="h-5 w-5" />
          </div>
        </div>
        <h2 className="text-lg font-semibold">{localize('com_projects_sources_title')}</h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-text-secondary">
          {localize('com_projects_sources_description')}
        </p>
        <input
          ref={inputRef}
          multiple
          type="file"
          className="hidden"
          onChange={(event) => handleFiles(event.target.files)}
        />
        <Button
          type="button"
          disabled={isUploading}
          className="mt-6 rounded-full"
          onClick={() => inputRef.current?.click()}
        >
          {isUploading ? (
            <Spinner className="mr-2 h-4 w-4" />
          ) : (
            <UploadCloud className="mr-2 h-4 w-4" />
          )}
          {localize('com_projects_add_sources')}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Spinner className="text-text-primary" />
        </div>
      ) : (
        files.map((file) => (
          <div
            key={file.file_id}
            className="flex items-center justify-between rounded-xl border border-border-light bg-surface-primary px-4 py-3"
          >
            <div className="flex min-w-0 items-center gap-3">
              <FileText className="h-5 w-5 flex-shrink-0 text-text-secondary" />
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{file.filename}</div>
                <div className="text-xs text-text-secondary">{formatBytes(file.bytes)}</div>
              </div>
            </div>
            <button
              type="button"
              className="rounded-lg p-2 text-text-secondary hover:bg-surface-hover hover:text-text-primary"
              aria-label={localize('com_projects_remove_source')}
              onClick={() => removeFile(file)}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))
      )}
    </div>
  );
}
