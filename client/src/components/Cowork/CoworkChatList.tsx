// cowork — project overview: lists every chat in a project. Shown when a project is open
// but no specific chat is selected (no ?convo / ?new). Clicking a row opens that chat;
// "New chat" starts a fresh conversation. This replaces auto-opening the latest chat.
import type { MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessagesSquare, SquarePen, Plus, Loader2, Trash2 } from 'lucide-react';
import { useCoworkConversationsQuery } from '~/data-provider/Cowork/queries';
import { useDeleteCoworkConversationMutation } from '~/data-provider/Cowork/mutations';

export default function CoworkChatList({ projectId }: { projectId: string }) {
  const navigate = useNavigate();
  const { data: conversations = [], isLoading } = useCoworkConversationsQuery(projectId);
  const deleteMutation = useDeleteCoworkConversationMutation(projectId);

  const openChat = (conversationId: string) =>
    navigate(`/cowork/${projectId}?convo=${conversationId}`);
  const newChat = () => navigate(`/cowork/${projectId}?new=${Date.now()}`);

  const handleDelete = (e: MouseEvent<HTMLButtonElement>, conversationId: string) => {
    e.stopPropagation();
    deleteMutation.mutate(conversationId);
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium text-text-primary">Chats</h2>
          <button
            type="button"
            onClick={newChat}
            className="flex items-center gap-1.5 rounded-md border border-border-medium px-2.5 py-1.5 text-sm text-text-primary transition-colors hover:bg-surface-secondary"
          >
            <SquarePen className="size-4" /> New chat
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-10 text-text-tertiary">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-text-secondary">
            <MessagesSquare className="size-8 text-text-info" />
            <p className="text-sm text-text-primary">No chats yet.</p>
            <button
              type="button"
              onClick={newChat}
              className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white transition-opacity hover:opacity-90"
            >
              <Plus className="size-4" /> Start a chat
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {conversations.map((c) => {
              const isDeleting =
                deleteMutation.isLoading && deleteMutation.variables === c.conversationId;
              return (
                <div
                  key={c.conversationId}
                  role="button"
                  tabIndex={0}
                  onClick={() => openChat(c.conversationId)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openChat(c.conversationId);
                    }
                  }}
                  className={`group flex cursor-pointer items-center gap-2.5 rounded-lg border border-border-medium bg-surface-secondary px-3 py-2.5 text-left transition-colors hover:bg-surface-tertiary ${
                    isDeleting ? 'opacity-50' : ''
                  }`}
                >
                  <MessagesSquare className="size-4 flex-none text-text-tertiary" />
                  <span className="min-w-0 flex-1 truncate text-sm text-text-primary">
                    {c.title || 'Untitled'}
                  </span>
                  <button
                    type="button"
                    title="Delete chat"
                    onClick={(e) => handleDelete(e, c.conversationId)}
                    disabled={isDeleting}
                    className="flex-none rounded p-1 text-text-tertiary opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100 disabled:pointer-events-none"
                  >
                    {isDeleting ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="size-3.5" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
