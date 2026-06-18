// cowork — workspace panel for a Cowork project (file tree + upload + preview).
//
// Project-scoped: takes a projectId prop (the dedicated Cowork shell supplies the
// active project's id). Reused inside the shell's right-hand workspace pane.
import { useCallback, useState } from 'react';
import { useToastContext } from '@librechat/client';
import { dataService } from 'librechat-data-provider';
import type { TCoworkFileNode } from 'librechat-data-provider';
import {
  useCoworkTreeQuery,
  useUploadCoworkFilesMutation,
  useDeleteCoworkFileMutation,
} from '~/data-provider';
import CoworkWorkspaceHeader from './CoworkWorkspaceHeader';
import type { CoworkUploadItem } from './CoworkWorkspaceHeader';
import CoworkFilePreview from './CoworkFilePreview';
import CoworkChangesPanel from './CoworkChangesPanel';
import CoworkHistoryPanel from './CoworkHistoryPanel';
import CoworkFileTree from './CoworkFileTree';

export default function CoworkWorkspacePanel({ projectId }: { projectId?: string }) {
  const id = projectId ?? '';
  const { showToast } = useToastContext();
  const [selected, setSelected] = useState<TCoworkFileNode | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ sent: number; total: number } | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);

  const treeQuery = useCoworkTreeQuery(id);
  const uploadMutation = useUploadCoworkFilesMutation(id);
  const deleteMutation = useDeleteCoworkFileMutation(id);

  const handleDownload = useCallback(
    async (node: TCoworkFileNode) => {
      try {
        const blob = await dataService.getCoworkFileBlob(id, node.path);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = node.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch {
        /* surfaced via the request error layer */
      }
    },
    [id],
  );

  const handleDownloadZip = useCallback(async () => {
    setIsDownloadingZip(true);
    try {
      const blob = await dataService.getCoworkArchiveBlob(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'cowork-workspace.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      showToast({ message: 'Could not download the workspace.', status: 'error' });
    } finally {
      setIsDownloadingZip(false);
    }
  }, [id, showToast]);

  const handleUpload = useCallback(
    (items: CoworkUploadItem[]) =>
      uploadMutation.mutate(
        {
          files: items,
          onProgress: (sent, total) => setUploadProgress({ sent, total }),
        },
        {
          onError: () =>
            showToast({
              message: 'Upload failed — a file may exceed the size limit.',
              status: 'error',
            }),
          onSettled: () => setUploadProgress(null),
        },
      ),
    [uploadMutation, showToast],
  );

  const handleDelete = useCallback(
    (node: TCoworkFileNode) => {
      deleteMutation.mutate(node.path);
      setSelected((cur) => (cur?.path === node.path ? null : cur));
    },
    [deleteMutation],
  );

  if (!id) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center text-text-secondary">
        <p className="text-sm">No project selected.</p>
        <p className="text-xs">Open a Cowork project to see its workspace.</p>
      </div>
    );
  }

  const data = treeQuery.data;

  return (
    // `relative` so CoworkFilePreview can use absolute inset-0 as an overlay.
    <div className="relative flex h-full flex-col">
      <CoworkWorkspaceHeader
        usage={data?.usage}
        quotaBytes={data?.quotaBytes}
        isFetching={treeQuery.isFetching}
        isUploading={uploadMutation.isLoading}
        uploadProgress={uploadProgress}
        isDownloading={isDownloadingZip}
        onUpload={handleUpload}
        onRefresh={() => treeQuery.refetch()}
        onOpenHistory={() => setShowHistory(true)}
        onDownloadZip={handleDownloadZip}
      />

      <CoworkChangesPanel projectId={id} />

      <div className="flex-1 overflow-auto py-2">
        {treeQuery.isError ? (
          <p className="px-4 py-6 text-center text-sm text-red-500">Could not load workspace.</p>
        ) : (
          <CoworkFileTree
            tree={data?.tree ?? []}
            selectedPath={selected?.path}
            onSelect={(node) => setSelected(node)}
            onDownload={handleDownload}
            onDelete={handleDelete}
          />
        )}
      </div>

      {selected && (
        <CoworkFilePreview
          projectId={id}
          node={selected}
          onClose={() => setSelected(null)}
          onDownload={handleDownload}
        />
      )}

      {showHistory && (
        <CoworkHistoryPanel projectId={id} onClose={() => setShowHistory(false)} />
      )}
    </div>
  );
}
