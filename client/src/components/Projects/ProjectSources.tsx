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
import { cn } from '~/utils';

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
  const [isDragging, setIsDragging] = useState(false);
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
        className={cn(
          'relative isolate flex min-h-[300px] flex-col items-center justify-center overflow-hidden px-6 py-12 text-center transition-colors duration-200',
          isDragging && 'bg-[#DAAC60]/[0.07]',
        )}
        aria-busy={isUploading}
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'copy';
          setIsDragging(true);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node)) {
            setIsDragging(false);
          }
        }}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          handleFiles(event.dataTransfer.files);
        }}
      >
        <div
          className="pointer-events-none absolute inset-x-16 top-10 -z-10 h-32 rounded-full bg-[#DAAC60]/10 blur-3xl dark:bg-[#DAAC60]/[0.07]"
          aria-hidden="true"
        />
        <div className="relative mb-6" aria-hidden="true">
          <div
            className={cn(
              'flex h-16 w-16 items-center justify-center rounded-full border border-[#DAAC60]/45 bg-[#DAAC60]/10 text-[#B47D26] shadow-[0_14px_34px_rgba(98,63,9,0.12)] transition-transform duration-200 dark:text-[#E8C37F]',
              isDragging && 'scale-110',
            )}
          >
            <UploadCloud className="h-7 w-7" />
          </div>
          <div className="absolute -bottom-1 -right-2 flex h-8 w-8 items-center justify-center rounded-full border border-border-light bg-surface-primary text-text-secondary shadow-sm">
            <Paperclip className="h-4 w-4" />
          </div>
        </div>
        <div className="mb-2 text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-[#B47D26] dark:text-[#E8C37F]">
          {localize('com_projects_sources_eyebrow')}
        </div>
        <h2 className="text-xl font-semibold tracking-[-0.02em] sm:text-2xl">
          {localize('com_projects_sources_title')}
        </h2>
        <p className="mt-2.5 max-w-lg text-sm leading-6 text-text-secondary">
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
          className="mt-6 min-w-[156px] rounded-full bg-[#DAAC60] px-6 text-[#10224A] shadow-[0_8px_22px_rgba(98,63,9,0.18)] hover:bg-[#E8C37F] focus-visible:ring-2 focus-visible:ring-[#DAAC60]/50 disabled:bg-[#DAAC60]/55 disabled:text-[#10224A]/65"
          onClick={() => inputRef.current?.click()}
        >
          {isUploading ? (
            <Spinner className="mr-2 h-4 w-4" />
          ) : (
            <UploadCloud className="mr-2 h-4 w-4" />
          )}
          {localize('com_projects_add_sources')}
        </Button>
        <p className="mt-4 text-xs font-medium text-text-secondary">
          {localize(
            isDragging ? 'com_projects_sources_drop_now' : 'com_projects_sources_drop_hint',
          )}
        </p>
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
