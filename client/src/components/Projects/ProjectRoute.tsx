import { useMemo, useState } from 'react';
import { FilePlus2, Folder, MessageSquarePlus, Plus } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Spinner } from '@librechat/client';
import type { FormEvent } from 'react';
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
  const { projectId = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [prompt, setPrompt] = useState('');
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

  return (
    <div className="chat-view-shell relative flex h-full flex-col overflow-y-auto bg-surface-primary text-text-primary">
      <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col px-5 py-6 sm:px-8 md:px-10 md:py-10">
        <header className="flex items-center gap-3">
          <div className="bg-surface-secondary/80 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-border-light backdrop-blur-sm">
            <Folder className="h-6 w-6" />
          </div>
          <h1 className="min-w-0 truncate text-2xl font-semibold tracking-tight md:text-3xl">
            {project.name}
          </h1>
        </header>

        <section className="bg-surface-primary/80 mt-7 overflow-hidden rounded-2xl border border-border-light shadow-sm backdrop-blur-xl md:mt-8">
          <form
            className="bg-surface-secondary/75 flex h-16 w-full items-center border-b border-border-light px-4 sm:px-5"
            onSubmit={startChat}
          >
            <button
              type="button"
              className="mr-3 rounded-xl p-2 transition-colors hover:bg-surface-hover"
              aria-label={localize('com_projects_new_chat_in_project', { name: project.name })}
              onClick={() => startChat()}
            >
              <Plus className="h-5 w-5" />
            </button>
            <input
              value={prompt}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-text-secondary sm:text-base"
              placeholder={localize('com_projects_new_chat_placeholder', { name: project.name })}
              onChange={(event) => setPrompt(event.target.value)}
            />
          </form>

          <div
            role="tablist"
            aria-label={project.name}
            className="flex h-14 items-end gap-6 border-b border-border-light px-5 sm:px-6"
          >
            {(['chats', 'sources'] as ProjectTab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={activeTab === tab}
                className={cn(
                  "relative h-full px-1 pt-1 text-sm font-medium transition-colors after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:rounded-full after:content-['']",
                  activeTab === tab
                    ? 'text-text-primary after:bg-text-primary'
                    : 'text-text-secondary after:bg-transparent hover:text-text-primary',
                )}
                onClick={() => setTab(tab)}
              >
                {tab === 'chats'
                  ? localize('com_projects_chats')
                  : localize('com_projects_sources')}
              </button>
            ))}
          </div>

          <div className="min-h-[400px] p-4 sm:p-6">
            {activeTab === 'sources' && <ProjectSources projectId={projectId} />}

            {activeTab === 'chats' && conversations.length === 0 && (
              <div className="relative isolate flex min-h-[350px] flex-col items-center justify-center overflow-hidden px-6 py-12 text-center">
                <div
                  className="pointer-events-none absolute inset-x-16 top-8 -z-10 h-36 rounded-full bg-[#DAAC60]/10 blur-3xl dark:bg-[#DAAC60]/[0.07]"
                  aria-hidden="true"
                />
                <div className="relative mb-6" aria-hidden="true">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[#DAAC60]/45 bg-[#DAAC60]/10 text-[#B47D26] shadow-[0_14px_34px_rgba(98,63,9,0.12)] dark:text-[#E8C37F]">
                    <MessageSquarePlus className="h-7 w-7" />
                  </div>
                </div>
                <div className="mb-2 text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-[#B47D26] dark:text-[#E8C37F]">
                  {localize('com_projects_empty_chats_eyebrow')}
                </div>
                <h2 className="max-w-xl text-xl font-semibold tracking-[-0.02em] sm:text-2xl">
                  {localize('com_projects_empty_chats_title', { name: project.name })}
                </h2>
                <p className="mt-2.5 max-w-lg text-sm leading-6 text-text-secondary">
                  {localize('com_projects_empty_chats_description')}
                </p>
                <div className="mt-6 flex flex-col items-center gap-2.5 sm:flex-row">
                  <button
                    type="button"
                    className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#DAAC60] px-5 py-2 text-sm font-semibold text-[#10224A] shadow-[0_8px_22px_rgba(98,63,9,0.18)] transition-colors hover:bg-[#E8C37F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DAAC60]/50 focus-visible:ring-offset-2 active:scale-[0.97]"
                    onClick={() => startChat()}
                  >
                    <MessageSquarePlus className="h-4 w-4" />
                    {localize('com_projects_new_chat_in_project', { name: project.name })}
                  </button>
                  <button
                    type="button"
                    className="bg-surface-primary/70 inline-flex min-h-10 items-center gap-2 rounded-full border border-[#3156B9]/70 px-5 py-2 text-sm font-medium text-text-primary transition-colors hover:border-[#3156B9] hover:bg-[#3156B9]/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B9]/40 focus-visible:ring-offset-2 active:scale-[0.97]"
                    onClick={() => setTab('sources')}
                  >
                    <FilePlus2 className="h-4 w-4 text-[#B47D26] dark:text-[#E8C37F]" />
                    {localize('com_projects_add_sources')}
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'chats' && conversations.length > 0 && (
              <div className="divide-y divide-border-light">
                {conversations.map((conversation) => {
                  if (!conversation.conversationId) {
                    return null;
                  }
                  return (
                    <button
                      key={conversation.conversationId}
                      type="button"
                      className="flex w-full items-center justify-between px-4 py-5 text-left transition-colors hover:bg-surface-hover"
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
        </section>
      </div>
    </div>
  );
}
