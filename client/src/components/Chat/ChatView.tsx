import { memo, useCallback } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useRecoilValue } from 'recoil';
import { useForm } from 'react-hook-form';
import { Spinner } from '@librechat/client';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Constants, buildTree } from 'librechat-data-provider';
import type { TMessage } from 'librechat-data-provider';
import type { ChatFormValues } from '~/common';
import { ChatContext, AddedChatContext, useFileMapContext, ChatFormProvider } from '~/Providers';
import {
  useAddedResponse,
  useResumeOnLoad,
  useAdaptiveSSE,
  useChatHelpers,
  useLocalize,
} from '~/hooks';
import { useGetAgentByIdQuery, useGetMessagesByConvoId } from '~/data-provider';
import AgentIntakeDialog from '~/components/Agents/AgentIntakeDialog';
import { getAgentIntakeTemplate } from '~/components/Agents/agentIntake';
import { getAgentIntakeLaunch } from '~/components/Agents/agentIntakeLaunch';
import MessagesView from './Messages/MessagesView';
import Presentation from './Presentation';
import ChatForm from './Input/ChatForm';
import Landing from './Landing';
import Header from './Header';
import Footer from './Footer';
import { pageRevealVariants, sectionStaggerVariants, softRevealVariants } from '~/utils/motion';
import { cn } from '~/utils';
import store from '~/store';

function LoadingSpinner() {
  return (
    <div className="relative flex-1 overflow-hidden overflow-y-auto">
      <div className="relative flex h-full items-center justify-center">
        <Spinner className="text-text-primary" />
      </div>
    </div>
  );
}

function MessageLoadError({ onRetry }: { onRetry: () => void }) {
  const localize = useLocalize();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-sm text-text-secondary">{localize('com_ui_error_connection')}</p>
      <button
        className="rounded-md border border-border-light px-3 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={onRetry}
        type="button"
      >
        {localize('com_ui_retry')}
      </button>
    </div>
  );
}

function ChatView({ index = 0 }: { index?: number }) {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const rootSubmission = useRecoilValue(store.submissionByIndex(index));
  const centerFormOnLanding = useRecoilValue(store.centerFormOnLanding);
  const shouldReduceMotion = useReducedMotion();

  const fileMap = useFileMapContext();

  const {
    data: messagesTree = null,
    isError: hasMessagesError,
    isLoading,
    refetch: refetchMessages,
  } = useGetMessagesByConvoId(conversationId ?? '', {
    select: useCallback(
      (data: TMessage[]) => {
        const dataTree = buildTree({ messages: data, fileMap });
        return dataTree?.length === 0 ? null : (dataTree ?? null);
      },
      [fileMap],
    ),
    enabled: !!fileMap,
  });

  const chatHelpers = useChatHelpers(index, conversationId);
  const addedChatHelpers = useAddedResponse();

  useAdaptiveSSE(rootSubmission, chatHelpers, false, index);

  // Auto-resume if navigating back to conversation with active job
  // Wait for messages to load before resuming to avoid race condition
  useResumeOnLoad(conversationId, chatHelpers.getMessages, index, !isLoading);

  const methods = useForm<ChatFormValues>({
    defaultValues: { text: '' },
  });

  let content: JSX.Element | null | undefined;
  const isLandingPage =
    (!messagesTree || messagesTree.length === 0) &&
    (conversationId === Constants.NEW_CONVO || !conversationId);
  const routeAgentId = searchParams.get('agent_id');
  const intakeLaunch = getAgentIntakeLaunch(searchParams.get('intake'));
  const isIntakeLaunchForRoute =
    intakeLaunch != null && intakeLaunch.agentId === routeAgentId && isLandingPage;
  const { data: routeAgent } = useGetAgentByIdQuery(routeAgentId, {
    enabled: isLandingPage && !!routeAgentId && !isIntakeLaunchForRoute,
  });
  const routeAgentIntakeTemplate = getAgentIntakeTemplate(routeAgent);
  const shouldOpenIntakeDialog =
    isLandingPage && !isIntakeLaunchForRoute && routeAgentIntakeTemplate != null;
  const handleIntakeCancel = useCallback(() => {
    navigate('/c/new', { replace: true });
  }, [navigate]);

  if (isLoading && conversationId !== Constants.NEW_CONVO) {
    content = <LoadingSpinner />;
  } else if (hasMessagesError) {
    content = <MessageLoadError onRetry={() => void refetchMessages()} />;
  } else if (!isLandingPage) {
    content = <MessagesView messagesTree={messagesTree} />;
  } else {
    content = <Landing centerFormOnLanding={centerFormOnLanding} />;
  }

  return (
    <ChatFormProvider {...methods}>
      <ChatContext.Provider value={chatHelpers}>
        <AddedChatContext.Provider value={addedChatHelpers}>
          <Presentation>
            <div className="chat-view-shell relative flex h-full w-full flex-col">
              {!isLoading && <Header />}
              <>
                <div
                  className={cn(
                    'flex flex-col',
                    isLandingPage
                      ? 'flex-1 items-center justify-end gap-8 sm:justify-center md:gap-10'
                      : 'h-full overflow-y-auto',
                  )}
                >
                  {isLandingPage ? (
                    <motion.div
                      variants={sectionStaggerVariants}
                      initial={shouldReduceMotion ? false : 'hidden'}
                      animate="visible"
                      className="chat-landing-page flex w-full flex-col items-center"
                    >
                      <motion.div
                        variants={pageRevealVariants}
                        className="chat-landing-page-body w-full"
                      >
                        {content}
                      </motion.div>
                      <motion.div
                        variants={softRevealVariants}
                        className={cn(
                          'chat-landing-page-composer w-full',
                          isLandingPage && 'max-w-3xl transition-all duration-200 xl:max-w-4xl',
                        )}
                      >
                        <ChatForm index={index} />
                      </motion.div>
                    </motion.div>
                  ) : (
                    <>
                      {content}
                      <div className="w-full">
                        <ChatForm index={index} />
                        <Footer />
                      </div>
                    </>
                  )}
                </div>
                {isLandingPage && <Footer />}
              </>
            </div>
            <AgentIntakeDialog
              agent={routeAgent ?? null}
              open={shouldOpenIntakeDialog}
              onOpenChange={() => undefined}
              onCancel={handleIntakeCancel}
            />
          </Presentation>
        </AddedChatContext.Provider>
      </ChatContext.Provider>
    </ChatFormProvider>
  );
}

export default memo(ChatView);
