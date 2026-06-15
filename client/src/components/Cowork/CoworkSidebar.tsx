// cowork — persistent left rail for the dedicated Cowork section.
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Folder, Briefcase, Puzzle, Plug, MessageSquare, Loader2 } from 'lucide-react';
import { useCoworkProjectsQuery, useCreateCoworkProjectMutation } from '~/data-provider';

export default function CoworkSidebar() {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const { data: projects = [] } = useCoworkProjectsQuery();
  const createMutation = useCreateCoworkProjectMutation();
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }
    createMutation.mutate(
      { name: trimmed },
      {
        onSuccess: (project) => {
          setName('');
          setCreating(false);
          navigate(`/cowork/${project._id}`);
        },
      },
    );
  };

  return (
    <aside className="flex h-full w-60 flex-none flex-col border-r border-border-medium px-3 py-4">
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
              if (e.key === 'Enter') {
                submit();
              }
              if (e.key === 'Escape') {
                setCreating(false);
                setName('');
              }
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
              onClick={() => {
                setCreating(false);
                setName('');
              }}
              className="rounded-md px-2 py-1 text-xs text-text-secondary hover:text-text-primary"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
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
            <button
              key={p._id}
              type="button"
              onClick={() => navigate(`/cowork/${p._id}`)}
              className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm ${
                active
                  ? 'bg-surface-tertiary text-text-primary'
                  : 'text-text-secondary hover:bg-surface-secondary'
              }`}
            >
              <Folder className="size-4 flex-none" />
              <span className="truncate">{p.name}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex flex-col gap-0.5 border-t border-border-medium pt-2">
        <span className="flex items-center gap-2 px-2 py-1.5 text-sm text-text-tertiary" title="Coming soon">
          <Puzzle className="size-4" /> Skills
        </span>
        <span className="flex items-center gap-2 px-2 py-1.5 text-sm text-text-tertiary" title="Coming soon">
          <Plug className="size-4" /> Connectors
        </span>
        <button
          type="button"
          onClick={() => navigate('/c/new')}
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-text-secondary hover:bg-surface-secondary hover:text-text-primary"
        >
          <MessageSquare className="size-4" /> Back to chat
        </button>
      </div>
    </aside>
  );
}
