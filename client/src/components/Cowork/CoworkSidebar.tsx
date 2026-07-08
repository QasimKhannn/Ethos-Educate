// cowork — persistent left rail for the dedicated Cowork section.
import { useState, type MouseEvent } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  Plus,
  Folder,
  Briefcase,
  Puzzle,
  Plug,
  MessageSquare,
  Loader2,
  SquarePen,
  MessagesSquare,
  Trash2,
  HelpCircle,
} from 'lucide-react';
import { useCoworkProjectsQuery, useCreateCoworkProjectMutation } from '~/data-provider';
import { useCoworkConversationsQuery } from '~/data-provider/Cowork/queries';
import { useDeleteCoworkConversationMutation } from '~/data-provider/Cowork/mutations';
import CoworkConnectorsModal from './CoworkConnectorsPanel';
import { CoworkSkillsModal } from './CoworkSkillsPanel';
import AccountSettings from '~/components/Nav/AccountSettings';

function timeAgo(dateStr?: string): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function ProjectConversations({
  projectId,
  activeConvoId,
  onNavigate,
}: {
  projectId: string;
  activeConvoId?: string | null;
  onNavigate?: () => void;
}) {
  const navigate = useNavigate();
  const { data: conversations = [], isLoading } = useCoworkConversationsQuery(projectId);
  const deleteMutation = useDeleteCoworkConversationMutation(projectId);

  const handleDelete = (e: MouseEvent<HTMLButtonElement>, conversationId: string) => {
    e.stopPropagation();
    deleteMutation.mutate(conversationId, {
      onSuccess: () => {
        // If the deleted conversation was active, navigate away to a new chat.
        if (conversationId === activeConvoId) {
          navigate(`/cowork/${projectId}?new=${Date.now()}`);
        }
      },
    });
  };

  if (isLoading) {
    return (
      <div className="pl-7 py-1">
        <Loader2 className="size-3 animate-spin text-text-tertiary" />
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="pl-7 py-1 text-xs text-text-tertiary">No conversations yet</div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      {conversations.map((c) => {
        const isActive = c.conversationId === activeConvoId;
        const isDeleting = deleteMutation.isLoading && deleteMutation.variables === c.conversationId;
        return (
          <div
            key={c.conversationId}
            className={`group flex w-full items-center gap-1 rounded-md py-1.5 pl-7 pr-1 text-xs transition-colors ${
              isActive
                ? 'bg-surface-tertiary text-text-primary'
                : 'text-text-secondary hover:bg-surface-secondary hover:text-text-primary'
            } ${isDeleting ? 'opacity-50' : ''}`}
          >
            <button
              type="button"
              onClick={() => {
                navigate(`/cowork/${projectId}?convo=${c.conversationId}`);
                onNavigate?.();
              }}
              className="flex min-w-0 flex-1 items-start gap-2 text-left"
              disabled={isDeleting}
            >
              <MessagesSquare className="mt-0.5 size-3 flex-none shrink-0 opacity-60" />
              <span className="min-w-0 flex-1 truncate">{c.title || 'Untitled'}</span>
            </button>
            <button
              type="button"
              title="Delete conversation"
              onClick={(e) => handleDelete(e, c.conversationId)}
              disabled={isDeleting}
              className="flex-none rounded p-0.5 text-text-tertiary opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-400 disabled:pointer-events-none"
            >
              {isDeleting ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Trash2 className="size-3" />
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default function CoworkSidebar({
  mobileOpen = false,
  onClose,
}: {
  mobileOpen?: boolean;
  onClose?: () => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { projectId } = useParams();

  // Navigate and close the mobile drawer in one step (no-op for the close on desktop).
  const go = (path: string) => {
    navigate(path);
    onClose?.();
  };

  const searchParams = new URLSearchParams(location.search);
  const activeConvoId = searchParams.get('convo');

  const { data: projects = [] } = useCoworkProjectsQuery();
  const createMutation = useCreateCoworkProjectMutation();
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [showConnectors, setShowConnectors] = useState(false);
  const [showSkills, setShowSkills] = useState(false);

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    createMutation.mutate(
      { name: trimmed },
      {
        onSuccess: (project) => {
          setName('');
          setCreating(false);
          go(`/cowork/${project._id}`);
        },
      },
    );
  };

  return (
    <>
      {/* Backdrop — only when the drawer is open on small screens. */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 h-full w-72 max-w-[85vw] flex-none flex-col border-r border-border-medium bg-surface-primary px-3 py-4 md:static md:z-auto md:w-60 md:max-w-none md:flex ${
          mobileOpen ? 'flex' : 'hidden'
        }`}
      >
        <div className="mb-4 flex items-center gap-2 px-1">
          <Briefcase className="size-5 text-text-secondary" />
          <span className="text-lg font-semibold text-text-primary">Cowork</span>
        </div>

      {creating ? (
        <div className="mb-4 flex flex-col gap-2">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
              if (e.key === 'Escape') { setCreating(false); setName(''); }
            }}
            placeholder="Project name"
            className="rounded-md border border-border-medium bg-surface-primary px-2 py-1.5 text-sm text-text-primary outline-none"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={submit}
              disabled={createMutation.isLoading || !name.trim()}
              className="flex items-center gap-1 rounded-md bg-surface-tertiary px-2 py-1 text-xs text-text-primary hover:bg-surface-hover disabled:opacity-50"
            >
              {createMutation.isLoading && <Loader2 className="size-3 animate-spin" />}
              Create
            </button>
            <button
              type="button"
              onClick={() => { setCreating(false); setName(''); }}
              className="rounded-md px-2 py-1 text-xs text-text-secondary hover:text-text-primary"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          data-tour-id="cowork-new-project"
          onClick={() => setCreating(true)}
          className="mb-4 flex items-center gap-2 rounded-md border border-border-medium px-2 py-1.5 text-sm text-text-primary hover:bg-surface-secondary"
        >
          <Plus className="size-4" /> New project
        </button>
      )}

      <div className="mb-1 px-1 text-xs text-text-tertiary">Projects</div>
      <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
        {projects.map((p) => {
          const active = p._id === projectId;
          return (
            <div key={p._id}>
              {/* Project row */}
              <div className={`flex items-center gap-1 rounded-md ${active ? 'bg-surface-tertiary' : ''}`}>
                <button
                  type="button"
                  onClick={() => go(`/cowork/${p._id}`)}
                  className={`flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left text-sm ${
                    active ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  <Folder className="size-4 flex-none" />
                  <span className="truncate">{p.name}</span>
                </button>
                {/* New chat shortcut — only on active project */}
                {active && (
                  <button
                    type="button"
                    title="New conversation"
                    onClick={() => go(`/cowork/${p._id}?new=${Date.now()}`)}
                    className="mr-1 flex-none rounded p-1 text-text-tertiary hover:text-text-primary"
                  >
                    <SquarePen className="size-3.5" />
                  </button>
                )}
              </div>

              {/* Conversation sub-list — only for the active project */}
              {active && (
                <div className="mt-0.5 mb-1">
                  <ProjectConversations
                    projectId={p._id}
                    activeConvoId={activeConvoId}
                    onNavigate={onClose}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex flex-col gap-0.5 border-t border-border-medium pt-2">
        {projectId ? (
          <button
            type="button"
            onClick={() => setShowSkills(true)}
            className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${
              showSkills
                ? 'bg-surface-tertiary text-text-primary'
                : 'text-text-secondary hover:bg-surface-secondary hover:text-text-primary'
            }`}
          >
            <Puzzle className="size-4" /> Skills
          </button>
        ) : (
          <span className="flex cursor-default items-center gap-2 px-2 py-1.5 text-sm text-text-tertiary" title="Open a project to manage skills">
            <Puzzle className="size-4" /> Skills
          </span>
        )}
        <button
          type="button"
          data-tour-id="cowork-connectors"
          onClick={() => setShowConnectors(true)}
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-text-secondary hover:bg-surface-secondary hover:text-text-primary"
        >
          <Plug className="size-4" /> Connectors
        </button>
        <button
          type="button"
          onClick={() => {
            window.dispatchEvent(new CustomEvent('cowork-tour-replay'));
            onClose?.();
          }}
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-text-secondary hover:bg-surface-secondary hover:text-text-primary"
        >
          <HelpCircle className="size-4" /> Take a tour
        </button>
        <button
          type="button"
          onClick={() => go('/c/new')}
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-text-secondary hover:bg-surface-secondary hover:text-text-primary"
        >
          <MessageSquare className="size-4" /> Back to chat
        </button>
        {/* cowork — signed-in account, pinned in the footer group (reuses the chat sidebar's
            account card: identity + settings + log out) so users can see who they are and sign
            out without leaving Cowork. */}
        <AccountSettings />
      </div>

        {showConnectors && <CoworkConnectorsModal onClose={() => setShowConnectors(false)} />}
        {showSkills && projectId && (
          <CoworkSkillsModal
            projectId={projectId}
            onClose={() => setShowSkills(false)}
            /* Lock skill changes while a saved conversation is open, matching the in-chat
               Skills tab — skills are injected at run start, so edit them before chatting. */
            locked={!!activeConvoId}
          />
        )}
      </aside>
    </>
  );
}
