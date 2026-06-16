// cowork — a single Cowork project: chat with the Cowork agent (center) +
// workspace/trace/skills (right pane).
import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, SquarePen } from 'lucide-react';
import { useCoworkProjectsQuery } from '~/data-provider';
import CoworkWorkspacePanel from '~/components/SidePanel/Cowork/CoworkWorkspacePanel';
import CoworkChat from './CoworkChat';
import CoworkTracePanel from './CoworkTracePanel';
import CoworkSkillsPanel from './CoworkSkillsPanel';
import type { CoworkTraceEntry } from './useCoworkChat';

type PaneTab = 'workspace' | 'trace' | 'skills';

const TABS: { id: PaneTab; label: string }[] = [
  { id: 'workspace', label: 'Workspace' },
  { id: 'trace', label: 'Trace' },
  { id: 'skills', label: 'Skills' },
];

export default function CoworkProjectView() {
  const { projectId = '' } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data: projects = [] } = useCoworkProjectsQuery();
  const project = projects.find((p) => p._id === projectId);

  // The last persisted conversation on the project doc (used as default).
  const latestConvoId = project?.conversationIds?.[project.conversationIds.length - 1];

  // ?convo= — set by sidebar when the user picks a specific conversation.
  const convoParam = searchParams.get('convo');
  // ?new= — timestamp set by "New chat" to force a fresh mount even without a convo param.
  const newParam = searchParams.get('new');
  // ?tab= — right panel tab.
  const tabParam = searchParams.get('tab') as PaneTab | null;

  const [tab, setTab] = useState<PaneTab>(
    tabParam && ['workspace', 'trace', 'skills'].includes(tabParam) ? tabParam : 'workspace',
  );
  const [trace, setTrace] = useState<CoworkTraceEntry[]>([]);

  // Reset trace when switching projects.
  useEffect(() => {
    setTrace([]);
  }, [projectId]);

  // Sync right-panel tab when ?tab= changes (e.g. sidebar Skills link).
  useEffect(() => {
    if (tabParam && ['workspace', 'trace', 'skills'].includes(tabParam)) {
      setTab(tabParam);
    }
  }, [tabParam]);

  // Which conversation to load:
  // - ?convo=<id>  → that specific conversation
  // - ?new=<ts>    → new conversation (undefined = blank slate)
  // - neither      → the latest linked conversation on the project
  const effectiveConvoId = newParam
    ? undefined
    : (convoParam ?? latestConvoId);

  // Mount key: changes whenever convo selection or new-chat param changes,
  // force-remounting CoworkChat with the right initial state.
  const chatMountKey = `${projectId}-${convoParam ?? 'default'}-${newParam ?? '0'}`;

  const newChat = () => {
    setTrace([]);
    navigate(`/cowork/${projectId}?new=${Date.now()}`);
  };

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
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium text-text-primary">
              {project?.name ?? 'Cowork project'}
            </div>
            <div className="text-xs text-text-tertiary">Cowork workspace</div>
          </div>
          <button
            type="button"
            onClick={newChat}
            title="New conversation"
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-text-secondary hover:bg-surface-secondary hover:text-text-primary"
          >
            <SquarePen className="size-4" />
            <span className="hidden sm:inline">New chat</span>
          </button>
        </header>

        <div className="min-h-0 flex-1">
          <CoworkChat
            key={chatMountKey}
            projectId={projectId}
            initialConversationId={effectiveConvoId}
            onTraceChange={setTrace}
          />
        </div>
      </div>

      <aside className="hidden w-80 flex-none flex-col border-l border-border-medium lg:flex">
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
          {tab === 'trace' && <CoworkTracePanel trace={trace} />}
          {tab === 'skills' && <CoworkSkillsPanel projectId={projectId} />}
        </div>
      </aside>
    </div>
  );
}
