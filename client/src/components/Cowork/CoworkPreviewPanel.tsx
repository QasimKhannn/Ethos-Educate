// cowork — Phase A / A1. Live preview of the coworker's latest artifact (a page,
// site, or React component) inside the Cowork right pane, reusing the existing
// Sandpack-based ArtifactPreview. Isolated from the main chat's Artifacts panel and
// Recoil state — it only reads the current run's messages passed in as a prop.
import { useRef, useState, useEffect, type MutableRefObject } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import type { SandpackPreviewRef } from '@codesandbox/sandpack-react/unstyled';
import { useGetStartupConfig } from '~/data-provider';
import useArtifactProps from '~/hooks/Artifacts/useArtifactProps';
import { ArtifactPreview } from '~/components/Artifacts/ArtifactPreview';
import { useCoworkLatestArtifact } from '~/hooks/Cowork/useCoworkLatestArtifact';
import type { Artifact } from '~/common';
import type { CoworkMessage } from './useCoworkChat';

function typeLabel(type?: string): string {
  switch (type) {
    case 'application/vnd.react':
    case 'application/vnd.ant.react':
      return 'React';
    case 'text/html':
    case 'application/vnd.code-html':
      return 'HTML';
    case 'image/svg+xml':
      return 'SVG';
    case 'application/vnd.mermaid':
      return 'Diagram';
    case 'text/markdown':
    case 'text/md':
      return 'Markdown';
    default:
      return 'Preview';
  }
}

function PreviewContent({ artifact }: { artifact: Artifact }) {
  // Mirror the main Artifacts panel's ref pattern (created empty, cast at use).
  const previewRef = useRef<SandpackPreviewRef>();
  const [fullscreen, setFullscreen] = useState(false);
  const { data: startupConfig } = useGetStartupConfig();
  const { files, fileKey, template, sharedProps } = useArtifactProps({ artifact });

  // Esc exits fullscreen. Only the wrapper class changes when toggling, so the
  // Sandpack instance is not remounted (no re-bundle / flash).
  useEffect(() => {
    if (!fullscreen) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFullscreen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen]);

  return (
    <div
      className={
        fullscreen
          ? 'fixed inset-0 z-[70] flex flex-col bg-surface-primary duration-200 animate-in fade-in-0'
          : 'flex h-full flex-col duration-200 animate-in fade-in-0'
      }
    >
      <div className="flex items-center gap-2 border-b border-border-medium px-3 py-2">
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-text-secondary">
          {artifact.title}
        </span>
        <span className="flex-none rounded bg-surface-tertiary px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-text-tertiary">
          {typeLabel(artifact.type)}
        </span>
        <button
          type="button"
          onClick={() => setFullscreen((v) => !v)}
          title={fullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen'}
          aria-label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          className="flex-none rounded p-1 text-text-tertiary transition-colors hover:bg-surface-secondary hover:text-text-primary"
        >
          {fullscreen ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden bg-white">
        <ArtifactPreview
          files={files}
          fileKey={fileKey}
          template={template}
          sharedProps={sharedProps}
          previewRef={previewRef as MutableRefObject<SandpackPreviewRef>}
          currentCode={artifact.content}
          startupConfig={startupConfig}
        />
      </div>
    </div>
  );
}

export default function CoworkPreviewPanel({ messages }: { messages: CoworkMessage[] }) {
  const artifact = useCoworkLatestArtifact(messages);

  if (!artifact) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-sm font-medium text-text-secondary">Nothing to preview yet</p>
        <p className="text-xs text-text-tertiary">
          Ask the coworker to build a page, site, or component — a live preview appears here, and
          you can still download the file from the Workspace tab.
        </p>
      </div>
    );
  }

  return <PreviewContent artifact={artifact} />;
}
