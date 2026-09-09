import { useMemo, useState } from 'react';
import {
  ArrowRight,
  FilePlus2,
  Folder,
  MessageSquarePlus,
  MessageSquareText,
  Paperclip,
  SendHorizontal,
} from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Spinner } from '@librechat/client';
import type { FormEvent } from 'react';
import { useProjectQuery, useConversationsInfiniteQuery } from '~/data-provider';
import { useAuthContext, useLocalize } from '~/hooks';
import { getAgentBuilderProviderLabel } from '~/utils/forms';
import { cn } from '~/utils';
import { flattenUniqueConversations, getProjectChatPath } from './utils';
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
    const trimmedPrompt = prompt.trim();
    navigate(getProjectChatPath(projectId, trimmedPrompt), { state: { focusChat: true } });
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
  const conversationCount = conversations.length;
  const sourceCount = project.fileIds?.length ?? 0;
  const conversationCountLabel = localize(
    conversationCount === 1 ? 'com_projects_chat_count_one' : 'com_projects_chat_count_other',
    { count: conversationCount },
  );
  const sourceCountLabel = localize(
    sourceCount === 1 ? 'com_projects_source_count_one' : 'com_projects_source_count_other',
    { count: sourceCount },
  );

  return (
    <div className="chat-view-shell project-route-shell relative flex h-full min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden bg-surface-primary text-text-primary">
      <div className="project-route-content mx-auto flex min-h-full w-full max-w-5xl flex-none flex-col px-5 py-6 sm:px-8 md:py-10">
        <header className="project-route-overview">
          <div className="project-route-identity">
            <div className="project-route-folder" aria-hidden="true">
              <Folder className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="project-route-eyebrow">{localize('com_projects_workspace')}</p>
              <h1 className="project-route-title">{project.name}</h1>
              <p className="project-route-description">
                {project.description?.trim() || localize('com_projects_workspace_description')}
              </p>
            </div>
          </div>
          <div
            className="project-route-meta"
            aria-label={localize('com_projects_workspace_summary')}
          >
            <span className="project-route-meta-item">
              <MessageSquareText className="h-4 w-4" aria-hidden="true" />
              {conversationCountLabel}
            </span>
            <span className="project-route-meta-item">
              <Paperclip className="h-4 w-4" aria-hidden="true" />
              {sourceCountLabel}
            </span>
          </div>
        </header>

        <form className="project-route-composer" onSubmit={startChat}>
          <div className="project-route-composer-copy">
            <span>{localize('com_projects_new_chat_in_project', { name: project.name })}</span>
            <small>{localize('com_projects_new_chat_description')}</small>
          </div>
          <div className="project-route-composer-field">
            <MessageSquarePlus className="h-5 w-5" aria-hidden="true" />
            <input
              value={prompt}
              aria-label={localize('com_projects_new_chat_placeholder', { name: project.name })}
              placeholder={localize('com_projects_new_chat_placeholder', { name: project.name })}
              onChange={(event) => setPrompt(event.target.value)}
            />
            <button
              type="submit"
              className="project-route-composer-submit"
              aria-label={localize('com_projects_start_chat')}
            >
              <SendHorizontal className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </form>

        <section className="project-route-card">
          <div role="tablist" aria-label={project.name} className="project-route-tabs">
            {(['chats', 'sources'] as ProjectTab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={activeTab === tab}
                className={cn('project-route-tab', activeTab === tab && 'project-route-tab-active')}
                onClick={() => setTab(tab)}
              >
                <span>
                  {tab === 'chats'
                    ? localize('com_projects_chats')
                    : localize('com_projects_sources')}
                </span>
                <span className="project-route-tab-count" aria-hidden="true">
                  {tab === 'chats' ? conversationCount : sourceCount}
                </span>
              </button>
            ))}
          </div>

          <div className="project-route-body">
            {activeTab === 'sources' && <ProjectSources projectId={projectId} />}

            {activeTab === 'chats' && conversations.length === 0 && (
              <div className="project-route-empty">
                <div className="relative mb-6" aria-hidden="true">
                  <div className="project-route-empty-icon">
                    <MessageSquarePlus className="h-7 w-7" />
                  </div>
                </div>
                <div className="project-route-empty-eyebrow">
                  {localize('com_projects_empty_chats_eyebrow')}
                </div>
                <h2 className="project-route-empty-title">
                  {localize('com_projects_empty_chats_title', { name: project.name })}
                </h2>
                <p className="project-route-empty-description">
                  {localize('com_projects_empty_chats_description')}
                </p>
                <div className="project-route-empty-actions">
                  <button
                    type="button"
                    className="project-route-primary-button"
                    onClick={() => startChat()}
                  >
                    <MessageSquarePlus className="h-4 w-4" />
                    {localize('com_projects_new_chat_in_project', { name: project.name })}
                  </button>
                  <button
                    type="button"
                    className="project-route-secondary-button"
                    onClick={() => setTab('sources')}
                  >
                    <FilePlus2 className="h-4 w-4" />
                    {localize('com_projects_add_sources')}
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'chats' && conversations.length > 0 && (
              <section aria-labelledby="project-recent-chats-title">
                <div className="project-route-section-heading">
                  <div>
                    <h2 id="project-recent-chats-title">{localize('com_projects_recent_chats')}</h2>
                    <p>{localize('com_projects_recent_chats_description')}</p>
                  </div>
                  <span className="project-route-section-count" aria-hidden="true">
                    {conversationCount}
                  </span>
                </div>
                <div className="project-route-conversations">
                  {conversations.map((conversation) => {
                    if (!conversation.conversationId) {
                      return null;
                    }
                    const conversationDate = getConversationDate(conversation);
                    return (
                      <button
                        key={conversation.conversationId}
                        type="button"
                        className="project-route-conversation"
                        onClick={() =>
                          navigate(`/c/${conversation.conversationId}?projectId=${projectId}`, {
                            state: { focusChat: true },
                          })
                        }
                      >
                        <span className="project-route-conversation-icon" aria-hidden="true">
                          <MessageSquareText className="h-5 w-5" />
                        </span>
                        <span className="project-route-conversation-copy">
                          <span className="project-route-conversation-title">
                            {conversation.title || localize('com_projects_chat')}
                          </span>
                          <span className="project-route-conversation-provider">
                            {getAgentBuilderProviderLabel(conversation.endpoint) ||
                              localize('com_projects_chat')}
                          </span>
                        </span>
                        <span className="project-route-conversation-end">
                          {conversationDate ? (
                            <time dateTime={conversation.updatedAt}>{conversationDate}</time>
                          ) : null}
                          <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
