// cowork — a single Cowork project: chat/goal area (center) + workspace (right).
//
// The center is a placeholder for now; the agent chat engine gets wired in next.
// The right pane has Workspace / Trace / Skills tabs (Workspace is live).
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { useCoworkProjectsQuery } from '~/data-provider';
import CoworkWorkspacePanel from '~/components/SidePanel/Cowork/CoworkWorkspacePanel';

type PaneTab = 'workspace' | 'trace' | 'skills';

const TABS: { id: PaneTab; label: string }[] = [
  { id: 'workspace', label: 'Workspace' },
  { id: 'trace', label: 'Trace' },
  { id: 'skills', label: 'Skills' },
];

export default function CoworkProjectView() {
  const { projectId = '' } = useParams();
  const navigate = useNavigate();
  const { data: projects = [] } = useCoworkProjectsQuery();
  const project = projects.find((p) => p._id === projectId);
  const [tab, setTab] = useState<PaneTab>('workspace');

  return (
    <div className="flex h-full w-full overflow-hidden">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-border-medium px-4 py-3">
          <button
            type="button"
            onClick={() => navigate('/cowork')}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-sm text-text-secondary hover:bg-surface-secondary hover:text-text-primary"
          >
            <ArrowLeft className="size-4" /> Projects
          </button>
          <div className="min-w-0">
            <div className="truncate font-medium text-text-primary">
              {project?.name ?? 'Cowork project'}
            </div>
            <div className="text-xs text-text-tertiary">Cowork workspace</div>
          </div>
        </header>

        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <Sparkles className="size-7 text-text-secondary" />
          <p className="max-w-md text-sm text-text-secondary">
            Project ready. The agent chat lands here next — for now, use the workspace on the right
            to upload files and folders.
          </p>
          <div className="mt-2 flex w-full max-w-xl items-center gap-2 rounded-lg border border-border-medium px-3 py-3 text-text-tertiary">
            <span className="flex-1 text-left text-sm">Message Cowork… (coming soon)</span>
          </div>
        </div>
      </div>

      <aside className="flex w-80 flex-none flex-col border-l border-border-medium">
        <div className="flex gap-1 border-b border-border-medium px-2 py-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-md px-2.5 py-1 text-sm ${
                tab === t.id
                  ? 'bg-surface-tertiary font-medium text-text-primary'
                  : 'text-text-secondary hover:bg-surface-secondary'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          {tab === 'workspace' && <CoworkWorkspacePanel projectId={projectId} />}
          {tab === 'trace' && (
            <div className="flex h-full flex-col items-center justify-center gap-1 px-4 text-center text-text-tertiary">
              <p className="text-sm">Trace coming soon</p>
              <p className="text-xs">Live steps the agent takes will appear here.</p>
            </div>
          )}
          {tab === 'skills' && (
            <div className="flex h-full flex-col items-center justify-center gap-1 px-4 text-center text-text-tertiary">
              <p className="text-sm">Skills coming soon</p>
              <p className="text-xs">Toggle PPTX / DOCX / XLSX / PDF skills for this project.</p>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
