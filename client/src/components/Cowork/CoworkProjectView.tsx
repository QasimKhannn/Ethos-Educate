// cowork — a single Cowork project: chat with the Cowork agent (center) +
// workspace/trace/skills (right pane).
import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  SquarePen,
  ChevronDown,
  Folder,
  Activity,
  Puzzle,
  Brain,
  Clock,
  PanelRight,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { TooltipAnchor } from '@librechat/client';
import { useCoworkProjectsQuery } from '~/data-provider';
import { useUpdateCoworkProjectMutation } from '~/data-provider/Cowork/mutations';
import CoworkWorkspacePanel from '~/components/SidePanel/Cowork/CoworkWorkspacePanel';
import CoworkChat from './CoworkChat';
import CoworkChatList from './CoworkChatList';
import CoworkTracePanel from './CoworkTracePanel';
import CoworkSkillsPanel from './CoworkSkillsPanel';
import CoworkMemoryPanel from './CoworkMemoryPanel';
import CoworkRoutinesPanel from './CoworkRoutinesPanel';
import { COWORK_MODELS, DEFAULT_COWORK_MODEL, resolveModelLabel } from './CoworkModels';
import type { CoworkTraceEntry } from './useCoworkChat';

type PaneTab = 'workspace' | 'trace' | 'skills' | 'memory' | 'routines';

const TABS: { id: PaneTab; label: string; icon: LucideIcon }[] = [
  { id: 'workspace', label: 'Workspace', icon: Folder },
  { id: 'trace', label: 'Trace', icon: Activity },
  { id: 'skills', label: 'Skills', icon: Puzzle },
  { id: 'memory', label: 'Memory', icon: Brain },
  { id: 'routines', label: 'Routines', icon: Clock },
];

const PANE_TABS: PaneTab[] = ['workspace', 'trace', 'skills', 'memory', 'routines'];

// ---------------------------------------------------------------------------
// Inline model picker — a small dropdown anchored to the header button.
// ---------------------------------------------------------------------------

function ModelPicker({
  currentModel,
  onSelect,
  disabled,
}: {
  currentModel: string;
  onSelect: (model: string, provider: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (disabled) {
    return (
      <TooltipAnchor
        side="bottom"
        role="button"
        description="No model switch allowed after the session has started. Create a new chat to switch the model."
        className="flex cursor-not-allowed items-center gap-1 rounded-md px-2 py-1.5 text-xs text-text-tertiary opacity-50"
      >
        <span>{resolveModelLabel(currentModel)}</span>
        <ChevronDown className="size-3 opacity-60" />
      </TooltipAnchor>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-text-secondary hover:bg-surface-secondary hover:text-text-primary"
        title="Switch model"
      >
        <span>{resolveModelLabel(currentModel)}</span>
        <ChevronDown className="size-3 opacity-60" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 min-w-[140px] overflow-hidden rounded-lg border border-border-medium bg-surface-primary shadow-lg">
          {COWORK_MODELS.map((m) => (
            <button
              key={m.model}
              type="button"
              onClick={() => {
                onSelect(m.model, m.provider);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-surface-secondary ${
                m.model === currentModel
                  ? 'font-medium text-text-primary'
                  : 'text-text-secondary'
              }`}
            >
              {m.model === currentModel && (
                <span className="size-1.5 flex-none rounded-full bg-text-info" />
              )}
              {m.model !== currentModel && <span className="size-1.5 flex-none" />}
              {m.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------

export default function CoworkProjectView() {
  const { projectId = '' } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data: projects = [] } = useCoworkProjectsQuery();
  const project = projects.find((p) => p._id === projectId);
  const updateMutation = useUpdateCoworkProjectMutation(projectId);

  // ?convo= — set by sidebar when the user picks a specific conversation.
  const convoParam = searchParams.get('convo');
  // ?new= — timestamp set by "New chat" to force a fresh mount even without a convo param.
  const newParam = searchParams.get('new');
  // ?tab= — right panel tab.
  const tabParam = searchParams.get('tab') as PaneTab | null;

  const [tab, setTab] = useState<PaneTab>(
    tabParam && PANE_TABS.includes(tabParam) ? tabParam : 'workspace',
  );
  // Right panel as a slide-in drawer on small screens (static aside on lg+).
  const [panelOpen, setPanelOpen] = useState(false);
  const [trace, setTrace] = useState<CoworkTraceEntry[]>([]);

  // Reset trace when switching projects.
  useEffect(() => {
    setTrace([]);
  }, [projectId]);

  // Sync right-panel tab when ?tab= changes (e.g. sidebar Skills link); also reveal it on mobile.
  useEffect(() => {
    if (tabParam && PANE_TABS.includes(tabParam)) {
      setTab(tabParam);
      setPanelOpen(true);
    }
  }, [tabParam]);

  // What the center pane shows:
  // - ?convo=<id>  → that specific conversation (chat)
  // - ?new=<ts>    → a fresh conversation (chat, blank slate)
  // - neither      → the project's chat-list overview (no chat auto-opened)
  const showChatList = !convoParam && !newParam;
  const effectiveConvoId = newParam ? undefined : (convoParam ?? undefined);

  // Mount key: changes whenever convo selection or new-chat param changes,
  // force-remounting CoworkChat with the right initial state.
  const chatMountKey = `${projectId}-${convoParam ?? 'default'}-${newParam ?? '0'}`;

  const newChat = () => {
    setTrace([]);
    navigate(`/cowork/${projectId}?new=${Date.now()}`);
  };

  // Resolved model/provider for this project (fall back to the seeded agent defaults).
  const activeModel = project?.model ?? DEFAULT_COWORK_MODEL.model;
  const activeProvider = project?.provider ?? DEFAULT_COWORK_MODEL.provider;

  // Lock the model to whatever was active when this chat mounted.
  // The picker saves to the project immediately, but only takes effect on the
  // next new conversation — matching Claude Code's per-session lock behavior.
  const [lockedModel] = useState(activeModel);
  const [lockedProvider] = useState(activeProvider);

  // Tracks whether this session has started (history loaded or first message sent).
  // Reset whenever a new chat mounts so the picker is re-enabled.
  const [sessionStarted, setSessionStarted] = useState(false);
  useEffect(() => {
    setSessionStarted(false);
  }, [chatMountKey]);

  const handleModelSelect = (model: string, provider: string) => {
    updateMutation.mutate({ model, provider });
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

          {/* Model picker */}
          {project && (
            <ModelPicker
              currentModel={activeModel}
              onSelect={handleModelSelect}
              disabled={sessionStarted}
            />
          )}

          <button
            type="button"
            onClick={newChat}
            title="New conversation"
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-text-secondary hover:bg-surface-secondary hover:text-text-primary"
          >
            <SquarePen className="size-4" />
            <span className="hidden sm:inline">New chat</span>
          </button>

          {/* Right-panel toggle — only on small screens where the panel is a drawer. */}
          <button
            type="button"
            onClick={() => setPanelOpen(true)}
            title="Open panels"
            aria-label="Open panels"
            className="flex items-center rounded-md px-2 py-1.5 text-text-secondary hover:bg-surface-secondary hover:text-text-primary lg:hidden"
          >
            <PanelRight className="size-4" />
          </button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col">
          {showChatList ? (
            <CoworkChatList projectId={projectId} />
          ) : (
            <CoworkChat
              key={chatMountKey}
              projectId={projectId}
              initialConversationId={effectiveConvoId}
              onTraceChange={setTrace}
              model={lockedModel}
              provider={lockedProvider}
              onSessionStart={() => setSessionStarted(true)}
            />
          )}
        </div>
      </div>

      {/* Backdrop — only when the drawer is open on small screens. */}
      {panelOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setPanelOpen(false)}
          aria-hidden
        />
      )}

      <aside
        className={`fixed inset-y-0 right-0 z-50 w-80 max-w-[85vw] flex-none flex-col border-l border-border-medium bg-surface-primary lg:static lg:z-auto lg:max-w-none lg:flex ${
          panelOpen ? 'flex' : 'hidden'
        }`}
      >
        <div className="flex items-center gap-1 overflow-x-auto border-b border-border-medium px-2 py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                title={t.label}
                aria-label={t.label}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-none items-center gap-1.5 rounded-md text-sm transition-colors ${
                  active
                    ? 'bg-surface-tertiary px-2.5 py-1 font-medium text-text-primary'
                    : 'px-2 py-1 text-text-secondary hover:bg-surface-secondary hover:text-text-primary'
                }`}
              >
                <Icon className="size-4 flex-none" />
                {active && <span>{t.label}</span>}
              </button>
            );
          })}
          {/* Close the drawer — only on small screens. */}
          <button
            type="button"
            onClick={() => setPanelOpen(false)}
            aria-label="Close panel"
            className="ml-auto flex-none rounded-md p-1 text-text-tertiary hover:bg-surface-secondary hover:text-text-primary lg:hidden"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          {tab === 'workspace' && <CoworkWorkspacePanel projectId={projectId} />}
          {tab === 'trace' && <CoworkTracePanel trace={trace} />}
          {tab === 'skills' && <CoworkSkillsPanel projectId={projectId} />}
          {tab === 'memory' && <CoworkMemoryPanel projectId={projectId} />}
          {tab === 'routines' && <CoworkRoutinesPanel projectId={projectId} />}
        </div>
      </aside>
    </div>
  );
}
