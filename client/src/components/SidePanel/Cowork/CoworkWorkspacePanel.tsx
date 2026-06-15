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
import CoworkFileTree from './CoworkFileTree';

export default function CoworkWorkspacePanel({ projectId }: { projectId?: string }) {
  const id = projectId ?? '';
  const { showToast } = useToastContext();
  const [selected, setSelected] = useState<TCoworkFileNode | null>(null);

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

  const handleUpload = useCallback(
    (items: CoworkUploadItem[]) =>
      uploadMutation.mutate(
        { files: items },
        {
          onError: () =>
            showToast({
              message: 'Upload failed — a file may exceed the size limit.',
              status: 'error',
            }),
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
    <div className="flex h-full flex-col">
      <CoworkWorkspaceHeader
        usage={data?.usage}
        quotaBytes={data?.quotaBytes}
        isFetching={treeQuery.isFetching}
        isUploading={uploadMutation.isLoading}
        onUpload={handleUpload}
        onRefresh={() => treeQuery.refetch()}
      />

      <div className="flex-1 overflow-auto p-1">
        {treeQuery.isError ? (
          <p className="px-3 py-6 text-center text-sm text-red-500">Could not load workspace.</p>
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
    </div>
  );
}
