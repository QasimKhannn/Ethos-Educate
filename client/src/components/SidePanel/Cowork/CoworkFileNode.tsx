// cowork — a single row in the workspace file tree (recursive for directories).
import { useState } from 'react';
import { ChevronRight, ChevronDown, Folder, FileText, Download, Trash2 } from 'lucide-react';
import type { TCoworkFileNode } from 'librechat-data-provider';

type Props = {
  node: TCoworkFileNode;
  depth: number;
  selectedPath?: string;
  onSelect: (node: TCoworkFileNode) => void;
  onDownload: (node: TCoworkFileNode) => void;
  onDelete: (node: TCoworkFileNode) => void;
};

const formatBytes = (bytes?: number): string => {
  if (bytes == null) {
    return '';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(1)} ${units[i]}`;
};

export default function CoworkFileNode({
  node,
  depth,
  selectedPath,
  onSelect,
  onDownload,
  onDelete,
}: Props) {
  const [expanded, setExpanded] = useState(depth === 0);
  const isDir = node.type === 'directory';
  const isSelected = selectedPath === node.path;

  return (
    <div>
      <div
        className={`group flex items-center gap-1 rounded-md px-1 py-1 text-sm hover:bg-surface-secondary ${
          isSelected ? 'bg-surface-secondary' : ''
        }`}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
      >
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-text-primary"
          onClick={() => (isDir ? setExpanded((v) => !v) : onSelect(node))}
        >
          {isDir ? (
            expanded ? (
              <ChevronDown className="size-3.5 shrink-0 text-text-secondary" />
            ) : (
              <ChevronRight className="size-3.5 shrink-0 text-text-secondary" />
            )
          ) : (
            <span className="w-3.5 shrink-0" />
          )}
          {isDir ? (
            <Folder className="size-4 shrink-0 text-text-secondary" />
          ) : (
            <FileText className="size-4 shrink-0 text-text-secondary" />
          )}
          <span className="truncate">{node.name}</span>
          {!isDir && (
            <span className="ml-1 shrink-0 text-xs text-text-secondary">
              {formatBytes(node.size)}
            </span>
          )}
        </button>

        {!isDir && (
          <button
            type="button"
            title="Download"
            className="hidden shrink-0 rounded p-1 text-text-secondary hover:text-text-primary group-hover:block"
            onClick={() => onDownload(node)}
          >
            <Download className="size-3.5" />
          </button>
        )}
        <button
          type="button"
          title="Delete"
          className="hidden shrink-0 rounded p-1 text-text-secondary hover:text-red-500 group-hover:block"
          onClick={() => onDelete(node)}
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      {isDir && expanded && node.children && node.children.length > 0 && (
        <div>
          {node.children.map((child) => (
            <CoworkFileNode
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              onSelect={onSelect}
              onDownload={onDownload}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
