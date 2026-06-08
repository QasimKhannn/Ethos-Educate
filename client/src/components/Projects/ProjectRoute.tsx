import { useMemo, useState } from 'react';
import { Folder, Plus } from 'lucide-react';
import { useNavigate, useOutletContext, useParams, useSearchParams } from 'react-router-dom';
import { Spinner, useMediaQuery } from '@librechat/client';
import type { FormEvent } from 'react';
import type { ContextType } from '~/common';
import { OpenSidebar } from '~/components/Chat/Menus';
import { useProjectQuery, useConversationsInfiniteQuery } from '~/data-provider';
import { useAuthContext, useLocalize } from '~/hooks';
import { cn } from '~/utils';
import { flattenUniqueConversations } from './utils';
import ProjectSources from './ProjectSources';

type ProjectTab = 'chats' | 'sources';
type ProjectConversation = {
  conversationId?: string | null;
  endpoint?: string | null;
  title?: string | null;
  updatedAt?: string;
};

const getConversationDate = (conversation: ProjectConversation) => {
  if (!conversation.updatedAt) {
    return '';
  }
  return new Date(conversation.updatedAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
};

export default function ProjectRoute() {
  const localize = useLocalize();
  const navigate = useNavigate();
  const { navVisible, setNavVisible } = useOutletContext<ContextType>();
  const { projectId = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [prompt, setPrompt] = useState('');
  const isSmallScreen = useMediaQuery('(max-width: 767px)');
  const activeTab = (searchParams.get('tab') as ProjectTab | null) ?? 'chats';
  const { isAuthenticated } = useAuthContext();
  const projectQuery = useProjectQuery(projectId, { enabled: isAuthenticated && !!projectId });
  const conversationsQuery = useConversationsInfiniteQuery(
    { projectId },
    { enabled: isAuthenticated && !!projectId },
  );

  const conversations = useMemo(
    () => flattenUniqueConversations(conversationsQuery.data?.pages),
    [conversationsQuery.data],
  );

  const setTab = (tab: ProjectTab) => {
    const params = new URLSearchParams(searchParams);
    params.set('tab', tab);
    setSearchParams(params, { replace: true });
  };

  const startChat = (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const params = new URLSearchParams({ projectId });
    const trimmedPrompt = prompt.trim();
    if (trimmedPrompt) {
      params.set('q', trimmedPrompt);
      params.set('submit', 'true');
    }
    navigate(`/c/new?${params.toString()}`, { state: { focusChat: true } });
  };

  if (!isAuthenticated) {
    return null;
  }

  if (projectQuery.isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner className="text-text-primary" />
      </div>
    );
  }

  if (!projectQuery.data) {
    return (
      <div className="flex h-full items-center justify-center text-text-secondary">
        {localize('com_projects_not_found')}
      </div>
    );
  }

  const project = projectQuery.data;
  const shouldShowOpenSidebar = !isSmallScreen && !navVisible;

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-surface-primary text-text-primary">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-12 md:px-12">
        {shouldShowOpenSidebar && (
          <div className="mb-6 flex items-center">
            <OpenSidebar setNavVisible={setNavVisible} />
          </div>
        )}
        <div className="mb-12 flex items-center gap-4">
          <Folder className="h-10 w-10" />
          <h1 className="text-4xl font-semibold tracking-tight">{project.name}</h1>
        </div>

        <form
          className="mx-auto flex h-16 w-full max-w-4xl items-center rounded-full bg-surface-secondary px-6 shadow-sm"
          onSubmit={startChat}
        >
          <button
            type="button"
            className="mr-4 rounded-full p-1 hover:bg-surface-hover"
            aria-label={localize('com_projects_new_chat_in_project', { name: project.name })}
            onClick={() => startChat()}
          >
            <Plus className="h-6 w-6" />
          </button>
          <input
            value={prompt}
            className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-text-secondary"
            placeholder={localize('com_projects_new_chat_placeholder', { name: project.name })}
            onChange={(event) => setPrompt(event.target.value)}
          />
        </form>

        <div className="mx-auto mt-10 flex w-full max-w-4xl gap-2">
          {(['chats', 'sources'] as ProjectTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              className={cn(
                'rounded-full px-5 py-3 text-sm font-medium',
                activeTab === tab
                  ? 'bg-surface-active-alt text-text-primary'
                  : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary',
              )}
              onClick={() => setTab(tab)}
            >
              {tab === 'chats' ? localize('com_projects_chats') : localize('com_projects_sources')}
            </button>
          ))}
        </div>

        <div className="mx-auto mt-8 w-full max-w-4xl">
          {activeTab === 'sources' ? (
            <ProjectSources projectId={projectId} />
          ) : conversations.length === 0 ? (
            <div className="mt-40 text-center">
              <h2 className="text-lg font-semibold">{localize('com_projects_no_chats')}</h2>
              <p className="mt-2 text-sm text-text-secondary">
                {localize('com_projects_no_chats_description', { name: project.name })}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border-light">
              {conversations.map((conversation) => {
                if (!conversation.conversationId) {
                  return null;
                }
                return (
                  <button
                    key={conversation.conversationId}
                    type="button"
                    className="flex w-full items-center justify-between px-4 py-5 text-left hover:bg-surface-hover"
                    onClick={() =>
                      navigate(`/c/${conversation.conversationId}?projectId=${projectId}`, {
                        state: { focusChat: true },
                      })
                    }
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{conversation.title}</span>
                      <span className="block truncate text-sm text-text-secondary">
                        {conversation.endpoint ?? localize('com_projects_chat')}
                      </span>
                    </span>
                    <span className="ml-4 flex-shrink-0 text-sm text-text-secondary">
                      {getConversationDate(conversation)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
