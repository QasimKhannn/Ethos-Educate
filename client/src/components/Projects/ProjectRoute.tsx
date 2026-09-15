import { useMemo } from 'react';
import { ArrowRight, Folder, MessageSquarePlus, MessageSquareText } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Spinner } from '@librechat/client';
import { useConversationsInfiniteQuery, useProjectQuery } from '~/data-provider';
import { useAuthContext, useLocalize, useNewConvo } from '~/hooks';
import { cn } from '~/utils';
import { flattenUniqueConversations } from './utils';
import ProjectSources from './ProjectSources';

type ProjectTab = 'chats' | 'sources';
type ProjectConversation = {
  conversationId?: string | null;
  title?: string | null;
  updatedAt?: string;
};

const getConversationDate = (conversation: ProjectConversation) => {
  if (!conversation.updatedAt) {
    return null;
  }

  return new Date(conversation.updatedAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
};

export default function ProjectRoute() {
  const localize = useLocalize();
  const navigate = useNavigate();
  const { newConversation } = useNewConvo();
  const { projectId = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
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
  const activeTab = (searchParams.get('tab') as ProjectTab | null) ?? 'chats';

  const setTab = (tab: ProjectTab) => {
    const params = new URLSearchParams(searchParams);
    params.set('tab', tab);
    setSearchParams(params, { replace: true });
  };

  const startChat = () => {
    newConversation({ template: { projectId } });
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
    <div className="chat-view-shell project-route-shell relative flex h-full min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden bg-surface-primary text-text-primary">
      <div className="project-route-content mx-auto flex min-h-full w-full max-w-4xl flex-none flex-col px-5 py-6 sm:px-8 md:py-10">
        <header className="project-route-overview">
          <div className="project-route-identity">
            <div className="project-route-folder" aria-hidden="true">
              <Folder className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <h1 className="project-route-title">{project.name}</h1>
              {project.description?.trim() ? (
                <p className="project-route-description">{project.description}</p>
              ) : null}
            </div>
          </div>
          <button type="button" className="project-route-new-chat" onClick={startChat}>
            <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
            {localize('com_projects_new_chat_in_project', { name: project.name })}
          </button>
        </header>

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
                {tab === 'chats'
                  ? localize('com_projects_chats')
                  : localize('com_projects_sources')}
              </button>
            ))}
          </div>

          <div className="project-route-body">
            {activeTab === 'sources' ? <ProjectSources projectId={projectId} /> : null}

            {activeTab === 'chats' && conversations.length === 0 ? (
              <div className="project-route-empty">
                <MessageSquareText className="h-5 w-5" aria-hidden="true" />
                <div>
                  <h2>{localize('com_projects_no_chats')}</h2>
                  <p>{localize('com_projects_no_chats_description', { name: project.name })}</p>
                </div>
              </div>
            ) : null}

            {activeTab === 'chats' && conversations.length > 0 ? (
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
                      <MessageSquareText className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                      <span className="project-route-conversation-title">
                        {conversation.title || localize('com_projects_chat')}
                      </span>
                      {conversationDate ? (
                        <time dateTime={conversation.updatedAt}>{conversationDate}</time>
                      ) : null}
                      <ArrowRight className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
