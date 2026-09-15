import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useRecoilCallback, useRecoilValue } from 'recoil';
import { Spinner, useToastContext } from '@librechat/client';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Constants, EModelEndpoint, QueryKeys } from 'librechat-data-provider';
import { useGetModelsQuery } from 'librechat-data-provider/react-query';
import type { TMessage, TModelsConfig, TPreset, TConversation } from 'librechat-data-provider';
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
  reconcileConversationModelSpec,
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
import { getPendingConversationHandoffKey } from '~/hooks/SSE/resumableNavigation';
import { NotificationSeverity } from '~/common';
import useAuthRedirect from './useAuthRedirect';
import temporaryStore from '~/store/temporary';
import store from '~/store';

const preserveConfiguredModel = (
  modelsData: TModelsConfig,
  endpoint?: string | null,
  model?: string | null,
): TModelsConfig => {
  if (!endpoint || !model) {
    return modelsData;
  }

  const availableModels = modelsData[endpoint] ?? [];
  if (availableModels.includes(model)) {
    return modelsData;
  }

  return {
    ...modelsData,
    [endpoint]: [model, ...availableModels],
  };
};

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
  });
  const isRouteNewConvo = conversationId === Constants.NEW_CONVO;
  const stagedConversation = queryClient.getQueryData<TConversation>([
    QueryKeys.conversation,
    conversationId,
  ]);
  const isPendingConversationHandoff =
    queryClient.getQueryData<boolean>(getPendingConversationHandoffKey(conversationId)) === true;
  const isPendingOutgoingHandoff =
    isRouteNewConvo &&
    conversation?.conversationId != null &&
    conversation.conversationId !== Constants.NEW_CONVO &&
    queryClient.getQueryData<boolean>(
      getPendingConversationHandoffKey(conversation.conversationId),
    ) === true;
  const hasPendingRouteConversation =
    isPendingConversationHandoff &&
    !isRouteNewConvo &&
    stagedConversation?.conversationId === conversationId;
  const routeNeedsExistingConversation =
    !isRouteNewConvo &&
    conversation?.conversationId !== conversationId &&
    !hasPendingRouteConversation;
  const initialConvoQuery = useGetConvoIdQuery(conversationId, {
    enabled:
      isAuthenticated &&
      !isRouteNewConvo &&
      mockConversation == null &&
      routeNeedsExistingConversation,
  });
  const isNewConversationHandoff =
    hasPendingRouteConversation && conversation?.conversationId !== conversationId;
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

  useLayoutEffect(() => {
    if (!isPendingConversationHandoff || isRouteNewConvo) {
      return;
    }

    if (
      stagedConversation?.conversationId === conversationId &&
      conversation?.conversationId !== conversationId
    ) {
      const nextConversation = reconcileConversationModelSpec(stagedConversation, startupConfig);
      hasSetConversation.current = true;
      setConversation(nextConversation);
    }

    queryClient.removeQueries(getPendingConversationHandoffKey(conversationId));
  }, [
    conversation?.conversationId,
    conversationId,
    hasSetConversation,
    isPendingConversationHandoff,
    isRouteNewConvo,
    queryClient,
    setConversation,
    stagedConversation,
    startupConfig,
  ]);

  useLayoutEffect(() => {
    const draftProjectId = conversation?.projectId ?? undefined;
    const routeProjectId = projectId ?? undefined;
    const needsDraft =
      !isPendingOutgoingHandoff &&
      conversationId === Constants.NEW_CONVO &&
      (conversation?.conversationId !== Constants.NEW_CONVO || draftProjectId !== routeProjectId);

    if (!needsDraft) {
      return;
    }

    hasSetConversation.current = false;
    setConversation({
      conversationId: Constants.NEW_CONVO as string,
      title: 'New Chat',
      endpoint: null,
      ...(routeProjectId ? { projectId: routeProjectId } : {}),
      createdAt: '',
      updatedAt: '',
    });
  }, [
    conversation?.conversationId,
    conversation?.projectId,
    conversationId,
    hasSetConversation,
    isPendingOutgoingHandoff,
    projectId,
    setConversation,
  ]);

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
  useLayoutEffect(() => {
    // Wait for roles to load so hasAgentAccess has a definitive value in useNewConvo
    const isNewConvo = conversationId === Constants.NEW_CONVO;
    const needsExistingConversation =
      !isNewConvo &&
      conversation?.conversationId !== conversationId &&
      !hasPendingRouteConversation;
    const rolesLoaded = roles?.USER != null;
    const routeDataReady =
      isNewConvo ||
      hasPendingRouteConversation ||
      initialConvoQuery.data != null ||
      initialConvoQuery.isError;
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
          needsExistingConversation)) ??
      false;
    /* Early exit if startupConfig is not loaded and conversation is already set and only initial models have loaded */
    if (!shouldSetConvo) {
      return;
    }

    const getNewConvoPreset = () => {
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

      if (querySettings.agent_id) {
        return querySettings;
      }

      const result = getDefaultModelSpec(startupConfig);
      const spec = result?.default ?? result?.last;
      const specPreset = spec ? getModelSpecPreset(spec) : undefined;

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
      const modelsData = preserveConfiguredModel(modelsQuery.data, preset?.endpoint, preset?.model);

      logger.log('conversation', 'ChatRoute, new convo effect', conversation);
      bootstrappedProjectIdRef.current = projectId;
      newConversation({
        modelsData,
        template: getProjectTemplate(),
        ...(preset ? { preset } : {}),
      });

      hasSetConversation.current = true;
    } else if (initialConvoQuery.data && endpointsQuery.data && modelsQuery.data) {
      const existingConversation = reconcileConversationModelSpec(
        initialConvoQuery.data,
        startupConfig,
      );
      const modelsData = preserveConfiguredModel(
        modelsQuery.data,
        existingConversation.endpoint,
        existingConversation.model,
      );

      logger.log('conversation', 'ChatRoute initialConvoQuery', existingConversation);
      newConversation({
        template: existingConversation,
        /* this is necessary to load all existing settings */
        preset: existingConversation as TPreset,
        modelsData,
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
        createdAt: '',
        updatedAt: '',
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
      const existingConversation = reconcileConversationModelSpec(
        initialConvoQuery.data,
        startupConfig,
      );
      const modelsData = modelsQuery.data
        ? preserveConfiguredModel(
            modelsQuery.data,
            existingConversation.endpoint,
            existingConversation.model,
          )
        : modelsQuery.data;

      logger.log('conversation', 'ChatRoute convo, assistants effect', existingConversation);
      newConversation({
        template: existingConversation,
        preset: existingConversation as TPreset,
        modelsData,
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

  if (!isRouteNewConvo && (endpointsQuery.isLoading || modelsQuery.isLoading)) {
    return (
      <div className="flex h-screen items-center justify-center" aria-live="polite" role="status">
        <Spinner className="text-text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (isRouteNewConvo) {
    return (
      <ToolCallsMapProvider conversationId={Constants.NEW_CONVO as string}>
        <ChatView index={index} />
      </ToolCallsMapProvider>
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
  if (
    conversationId !== Constants.NEW_CONVO &&
    conversation?.conversationId !== conversationId &&
    !isNewConversationHandoff
  ) {
    return (
      <div className="flex h-screen items-center justify-center" aria-live="polite" role="status">
        <Spinner className="text-text-primary" />
      </div>
    );
  }

  return (
    <ToolCallsMapProvider
      conversationId={
        isNewConversationHandoff ? conversationId : (conversation.conversationId ?? '')
      }
    >
      <ChatView index={index} />
    </ToolCallsMapProvider>
  );
}
