import { useEffect, useMemo, useRef } from 'react';
import { useRecoilCallback, useRecoilValue } from 'recoil';
import { Spinner, useToastContext } from '@librechat/client';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Constants, EModelEndpoint, QueryKeys } from 'librechat-data-provider';
import { useGetModelsQuery } from 'librechat-data-provider/react-query';
import type { TMessage, TPreset, TConversation } from 'librechat-data-provider';
import {
  useNewConvo,
  useAppStartup,
  useAssistantListMap,
  useIdChangeEffect,
  useLocalize,
} from '~/hooks';
import {
  useProjectQuery,
  useGetConvoIdQuery,
  useGetStartupConfig,
  useGetEndpointsQuery,
} from '~/data-provider';
import { useStreamStatus } from '~/data-provider/SSE/queries';
import {
  getDefaultModelSpec,
  getModelSpecPreset,
  processValidSettings,
  logger,
  isNotFoundError,
} from '~/utils';
import { ToolCallsMapProvider } from '~/Providers';
import ChatView from '~/components/Chat/ChatView';
import {
  getMockNavigationConversation,
  getMockNavigationMessages,
  isMockNavigationConversation,
} from '~/components/Nav/mockNavigation';
import { NotificationSeverity } from '~/common';
import useAuthRedirect from './useAuthRedirect';
import temporaryStore from '~/store/temporary';
import store from '~/store';

export default function ChatRoute() {
  const bootstrappedProjectIdRef = useRef<string | undefined>(undefined);
  const { data: startupConfig } = useGetStartupConfig();
  const { isAuthenticated, user, roles } = useAuthRedirect();

  const defaultTemporaryChat = useRecoilValue(temporaryStore.defaultTemporaryChat);
  const setIsTemporary = useRecoilCallback(
    ({ set }) =>
      (value: boolean) => {
        set(temporaryStore.isTemporary, value);
      },
    [],
  );
  useAppStartup({ startupConfig, user });

  const index = 0;
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId') || undefined;
  const { conversationId = '' } = useParams();
  useIdChangeEffect(conversationId);
  const queryClient = useQueryClient();
  const { hasSetConversation, conversation, setConversation } =
    store.useCreateConversationAtom(index);
  const { newConversation } = useNewConvo();
  const { showToast } = useToastContext();
  const localize = useLocalize();
  const mockConversation = useMemo(
    () =>
      isMockNavigationConversation(conversationId)
        ? getMockNavigationConversation(conversationId, localize, projectId)
        : undefined,
    [conversationId, localize, projectId],
  );
  const mockMessages = useMemo(
    () => (mockConversation ? getMockNavigationMessages(mockConversation, localize) : []),
    [localize, mockConversation],
  );

  const modelsQuery = useGetModelsQuery({
    enabled: isAuthenticated,
    refetchOnMount: 'always',
  });
  const isRouteNewConvo = conversationId === Constants.NEW_CONVO;
  const routeNeedsExistingConversation =
    !isRouteNewConvo && conversation?.conversationId !== conversationId;
  const initialConvoQuery = useGetConvoIdQuery(conversationId, {
    enabled:
      isAuthenticated &&
      !isRouteNewConvo &&
      mockConversation == null &&
      (!hasSetConversation.current || routeNeedsExistingConversation),
  });
  const streamStatusQuery = useStreamStatus(
    conversationId,
    isAuthenticated &&
      !isRouteNewConvo &&
      initialConvoQuery.isError &&
      isNotFoundError(initialConvoQuery.error),
  );
  const endpointsQuery = useGetEndpointsQuery({ enabled: isAuthenticated });
  const projectQuery = useProjectQuery(projectId, {
    enabled: isAuthenticated && isRouteNewConvo && !!projectId,
  });
  const assistantListMap = useAssistantListMap();

  const isTemporaryChat = conversation && conversation.expiredAt ? true : false;

  useEffect(() => {
    if (!mockConversation) {
      return;
    }

    hasSetConversation.current = true;
    queryClient.setQueryData<TConversation>(
      [QueryKeys.conversation, conversationId],
      mockConversation,
    );
    queryClient.setQueryData<TMessage[]>([QueryKeys.messages, conversationId], mockMessages);
    setConversation(mockConversation);
    document.title = mockConversation.title || localize('com_ui_new_chat');
  }, [
    conversationId,
    hasSetConversation,
    localize,
    mockConversation,
    mockMessages,
    queryClient,
    setConversation,
  ]);

  useEffect(() => {
    if (conversationId === Constants.NEW_CONVO) {
      setIsTemporary(defaultTemporaryChat);
    } else if (isTemporaryChat) {
      setIsTemporary(isTemporaryChat);
    } else {
      setIsTemporary(false);
    }
  }, [conversationId, isTemporaryChat, setIsTemporary, defaultTemporaryChat]);

  /** This effect is mainly for the first conversation state change on first load of the page.
   *  Adjusting this may have unintended consequences on the conversation state.
   */
  useEffect(() => {
    // Wait for roles to load so hasAgentAccess has a definitive value in useNewConvo
    const isNewConvo = conversationId === Constants.NEW_CONVO;
    const needsExistingConversation =
      !isNewConvo && conversation?.conversationId !== conversationId;
    const rolesLoaded = roles?.USER != null;
    const routeDataReady =
      isNewConvo || initialConvoQuery.data != null || initialConvoQuery.isError;
    const projectReady =
      !isNewConvo || !projectId || projectQuery.data != null || projectQuery.isError;
    const projectFileIds = projectQuery.data?.fileIds ?? [];
    const projectInstructions = projectQuery.data?.instructions ?? '';
    const hasBootstrappedCurrentProject = bootstrappedProjectIdRef.current === projectId;
    const newRouteNeedsFreshConversation =
      isNewConvo &&
      (conversation?.conversationId !== Constants.NEW_CONVO ||
        (projectId == null
          ? (conversation?.projectId || undefined) !== undefined
          : !hasBootstrappedCurrentProject &&
            (conversation?.projectId || undefined) !== projectId));
    const shouldSetConvo =
      (startupConfig &&
        rolesLoaded &&
        routeDataReady &&
        projectReady &&
        (!hasSetConversation.current ||
          newRouteNeedsFreshConversation ||
          needsExistingConversation) &&
        !modelsQuery.data?.initial) ??
      false;
    /* Early exit if startupConfig is not loaded and conversation is already set and only initial models have loaded */
    if (!shouldSetConvo) {
      return;
    }

    const getNewConvoPreset = () => {
      const result = getDefaultModelSpec(startupConfig);
      const spec = result?.default ?? result?.last;
      const specPreset = spec ? getModelSpecPreset(spec) : undefined;

      const queryParams: Record<string, string> = {};
      searchParams.forEach((value, key) => {
        if (
          key !== 'prompt' &&
          key !== 'q' &&
          key !== 'submit' &&
          key !== 'projectId' &&
          key !== 'intake'
        ) {
          queryParams[key] = value;
        }
      });
      const querySettings = processValidSettings(queryParams);

      return Object.keys(querySettings).length > 0
        ? { ...specPreset, ...querySettings }
        : specPreset;
    };

    const getProjectTemplate = (): Partial<TConversation> | undefined => {
      const template: Partial<TConversation> = {
        ...(projectId ? { projectId } : {}),
        ...(projectFileIds.length > 0 ? { file_ids: projectFileIds } : {}),
        ...(projectInstructions ? { promptPrefix: projectInstructions } : {}),
      };
      return Object.keys(template).length > 0 ? template : undefined;
    };

    if (isNewConvo && endpointsQuery.data && modelsQuery.data) {
      const preset = getNewConvoPreset();

      logger.log('conversation', 'ChatRoute, new convo effect', conversation);
      bootstrappedProjectIdRef.current = projectId;
      newConversation({
        modelsData: modelsQuery.data,
        template: getProjectTemplate(),
        ...(preset ? { preset } : {}),
      });

      hasSetConversation.current = true;
    } else if (initialConvoQuery.data && endpointsQuery.data && modelsQuery.data) {
      logger.log('conversation', 'ChatRoute initialConvoQuery', initialConvoQuery.data);
      newConversation({
        template: initialConvoQuery.data,
        /* this is necessary to load all existing settings */
        preset: initialConvoQuery.data as TPreset,
        modelsData: modelsQuery.data,
        keepLatestMessage: true,
      });
      hasSetConversation.current = true;
    } else if (
      conversationId &&
      endpointsQuery.data &&
      modelsQuery.data &&
      initialConvoQuery.isError &&
      isNotFoundError(initialConvoQuery.error) &&
      streamStatusQuery.data?.active
    ) {
      const streamingConversation: TConversation = {
        conversationId,
        title: 'New Chat',
        endpoint: EModelEndpoint.agents,
      };

      logger.log('conversation', 'ChatRoute resuming active stream', conversationId);
      queryClient.setQueryData<TConversation>(
        [QueryKeys.conversation, conversationId],
        streamingConversation,
      );
      setConversation(streamingConversation);
      hasSetConversation.current = true;
    } else if (
      conversationId &&
      endpointsQuery.data &&
      modelsQuery.data &&
      initialConvoQuery.isError &&
      isNotFoundError(initialConvoQuery.error) &&
      streamStatusQuery.isFetched
    ) {
      const result = getDefaultModelSpec(startupConfig);
      const spec = result?.default ?? result?.last;
      showToast({
        message: localize('com_ui_conversation_not_found'),
        severity: NotificationSeverity.WARNING,
      });
      logger.log(
        'conversation',
        'ChatRoute initialConvoQuery isNotFoundError',
        initialConvoQuery.error,
      );
      newConversation({
        modelsData: modelsQuery.data,
        ...(spec ? { preset: getModelSpecPreset(spec) } : {}),
      });
      hasSetConversation.current = true;
    } else if (
      isNewConvo &&
      assistantListMap[EModelEndpoint.assistants] &&
      assistantListMap[EModelEndpoint.azureAssistants]
    ) {
      const preset = getNewConvoPreset();

      logger.log('conversation', 'ChatRoute new convo, assistants effect', conversation);
      newConversation({
        modelsData: modelsQuery.data,
        template: getProjectTemplate(),
        ...(preset ? { preset } : {}),
      });
      hasSetConversation.current = true;
    } else if (
      !isNewConvo &&
      initialConvoQuery.data &&
      assistantListMap[EModelEndpoint.assistants] &&
      assistantListMap[EModelEndpoint.azureAssistants]
    ) {
      logger.log('conversation', 'ChatRoute convo, assistants effect', initialConvoQuery.data);
      newConversation({
        template: initialConvoQuery.data,
        preset: initialConvoQuery.data as TPreset,
        modelsData: modelsQuery.data,
        keepLatestMessage: true,
      });
      hasSetConversation.current = true;
    }
    /* Creates infinite render if all dependencies included due to newConversation invocations exceeding call stack before hasSetConversation.current becomes truthy */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    roles,
    startupConfig,
    initialConvoQuery.data,
    initialConvoQuery.isError,
    streamStatusQuery.data,
    streamStatusQuery.isFetched,
    endpointsQuery.data,
    modelsQuery.data,
    assistantListMap,
    projectId,
    projectQuery.data,
    projectQuery.isError,
  ]);

  if (endpointsQuery.isLoading || modelsQuery.isLoading) {
    return (
      <div className="flex h-screen items-center justify-center" aria-live="polite" role="status">
        <Spinner className="text-text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const isFreshNewConversation =
    conversation?.conversationId === Constants.NEW_CONVO &&
    (projectId == null || conversation.projectId === projectId);

  if (isRouteNewConvo && !isFreshNewConversation) {
    return (
      <div className="flex h-screen items-center justify-center" aria-live="polite" role="status">
        <Spinner className="text-text-primary" />
      </div>
    );
  }

  // if not a conversation
  if (conversation?.conversationId === Constants.SEARCH) {
    return null;
  }
  // if conversationId not match
  if (conversation?.conversationId !== conversationId && !conversation) {
    return null;
  }
  // if conversationId is null
  if (!conversationId) {
    return null;
  }
  if (conversationId !== Constants.NEW_CONVO && conversation?.conversationId !== conversationId) {
    return (
      <div className="flex h-screen items-center justify-center" aria-live="polite" role="status">
        <Spinner className="text-text-primary" />
      </div>
    );
  }

  return (
    <ToolCallsMapProvider conversationId={conversation.conversationId ?? ''}>
      <ChatView index={index} />
    </ToolCallsMapProvider>
  );
}
