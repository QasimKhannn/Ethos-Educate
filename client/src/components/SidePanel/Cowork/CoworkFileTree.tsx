// cowork — renders the workspace file tree (or an empty state).
import { FolderTree } from 'lucide-react';
import type { TCoworkFileNode } from 'librechat-data-provider';
import CoworkFileNode from './CoworkFileNode';

type Props = {
  tree: TCoworkFileNode[];
  selectedPath?: string;
  onSelect: (node: TCoworkFileNode) => void;
  onDownload: (node: TCoworkFileNode) => void;
  onDelete: (node: TCoworkFileNode) => void;
};

export default function CoworkFileTree({
  tree,
  selectedPath,
  onSelect,
  onDownload,
  onDelete,
}: Props) {
  const isEmpty =
    tree.length === 0 ||
    (tree.length === 1 && tree[0].type === 'directory' && !(tree[0].children?.length));

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center text-text-secondary">
        <FolderTree className="size-6" />
        <p className="text-sm">This workspace is empty.</p>
        <p className="text-xs">Upload a file, or ask the agent to create one.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {tree.map((node) => (
        <CoworkFileNode
          key={node.path}
          node={node}
          depth={0}
          selectedPath={selectedPath}
          onSelect={onSelect}
          onDownload={onDownload}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
