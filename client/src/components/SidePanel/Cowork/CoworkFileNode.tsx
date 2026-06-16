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
        className={`group flex items-center gap-1 rounded-lg py-1.5 text-sm transition-colors hover:bg-surface-secondary ${
          isSelected ? 'bg-surface-secondary font-medium' : ''
        }`}
        style={{ paddingLeft: `${depth * 14 + 12}px`, paddingRight: '8px' }}
      >
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 text-left text-text-primary"
          onClick={() => (isDir ? setExpanded((v) => !v) : onSelect(node))}
        >
          {isDir ? (
            expanded ? (
              <ChevronDown className="size-3.5 shrink-0 text-text-tertiary" />
            ) : (
              <ChevronRight className="size-3.5 shrink-0 text-text-tertiary" />
            )
          ) : (
            <span className="w-3.5 shrink-0" />
          )}
          {isDir ? (
            <Folder className="size-3.5 shrink-0 text-text-tertiary" />
          ) : (
            <FileText className="size-3.5 shrink-0 text-text-tertiary" />
          )}
          <span className="truncate text-sm">{node.name}</span>
          {!isDir && node.size != null && (
            <span className="ml-auto shrink-0 pl-2 text-[11px] text-text-tertiary">
              {formatBytes(node.size)}
            </span>
          )}
        </button>

        {!isDir && (
          <button
            type="button"
            title="Download"
            className="hidden shrink-0 rounded-md p-1 text-text-tertiary hover:text-text-primary group-hover:block"
            onClick={() => onDownload(node)}
          >
            <Download className="size-3.5" />
          </button>
        )}
        <button
          type="button"
          title="Delete"
          className="hidden shrink-0 rounded-md p-1 text-text-tertiary hover:text-red-500 group-hover:block"
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
