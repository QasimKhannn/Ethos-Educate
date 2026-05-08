import { useCallback, useMemo, useRef, useState } from 'react';
import { useDrop } from 'react-dnd';
import { useToastContext } from '@librechat/client';
import { NativeTypes } from 'react-dnd-html5-backend';
import { useQueryClient } from '@tanstack/react-query';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import {
  QueryKeys,
  Constants,
  EToolResources,
  EModelEndpoint,
  mergeFileConfig,
  AgentCapabilities,
  resolveEndpointType,
  isAssistantsEndpoint,
  getEndpointFileConfig,
  defaultAgentCapabilities,
} from 'librechat-data-provider';
import type { DropTargetMonitor } from 'react-dnd';
import type * as t from 'librechat-data-provider';
import store, { ephemeralAgentByConvoId } from '~/store';
import { isEphemeralAgent } from '~/common';
import useLocalize from '../useLocalize';
import useFileHandling from './useFileHandling';
import {
  resolveChatUploadToolResource,
  resolveProviderUploadFileType,
} from './uploadStrategy';

export default function useDragHelpers() {
  const queryClient = useQueryClient();
  const { showToast } = useToastContext();
  const localize = useLocalize();
  const [showModal, setShowModal] = useState(false);
  const [draggedFiles, setDraggedFiles] = useState<File[]>([]);
  const conversation = useRecoilValue(store.conversationByIndex(0)) || undefined;
  const conversationId = conversation?.conversationId ?? Constants.NEW_CONVO;
  const ephemeralAgent = useRecoilValue(ephemeralAgentByConvoId(conversationId));
  const setEphemeralAgent = useSetRecoilState(ephemeralAgentByConvoId(conversationId));
  const isAssistants = useMemo(
    () => isAssistantsEndpoint(conversation?.endpoint),
    [conversation?.endpoint],
  );
  const { handleFiles } = useFileHandling();

  const activateUploadTarget = useCallback(
    (toolResource?: EToolResources) => {
      if (toolResource == null) {
        return;
      }

      setEphemeralAgent((prev) => ({
        ...(prev ?? {}),
        [toolResource]: true,
      }));
    },
    [setEphemeralAgent],
  );

  const handleOptionSelect = useCallback(
    (toolResource: EToolResources | undefined) => {
      activateUploadTarget(toolResource);
      handleFiles(draggedFiles, toolResource);
      setShowModal(false);
      setDraggedFiles([]);
    },
    [activateUploadTarget, draggedFiles, handleFiles],
  );

  const handleFilesRef = useRef(handleFiles);
  const conversationRef = useRef(conversation);
  const ephemeralAgentRef = useRef(ephemeralAgent);

  handleFilesRef.current = handleFiles;
  conversationRef.current = conversation;
  ephemeralAgentRef.current = ephemeralAgent;

  const handleDrop = useCallback(
    (item: { files: File[] }) => {
      const currentEndpoint = conversationRef.current?.endpoint ?? 'default';
      const endpointsConfig = queryClient.getQueryData<t.TEndpointsConfig>([QueryKeys.endpoints]);
      const agentId = conversationRef.current?.agent_id;
      const agent = agentId
        ? queryClient.getQueryData<t.Agent>([QueryKeys.agent, agentId])
        : undefined;
      const currentEndpointType = resolveEndpointType(
        endpointsConfig,
        currentEndpoint,
        agent?.provider,
      );
      const cfg = queryClient.getQueryData<t.FileConfig>([QueryKeys.fileConfig]);

      if (cfg) {
        const mergedCfg = mergeFileConfig(cfg);
        const endpointCfg = getEndpointFileConfig({
          fileConfig: mergedCfg,
          endpoint: currentEndpoint,
          endpointType: currentEndpointType,
        });

        if (endpointCfg?.disabled === true) {
          showToast({
            message: localize('com_ui_attach_error_disabled'),
            status: 'error',
          });
          return;
        }
      }

      if (isAssistants) {
        handleFilesRef.current(item.files);
        return;
      }

      const capabilities = endpointsConfig?.[EModelEndpoint.agents]?.capabilities ?? defaultAgentCapabilities;
      const hasAgentSelection = agentId != null && agentId !== '';
      let fileSearchAvailable =
        capabilities.includes(AgentCapabilities.file_search) === true && !hasAgentSelection;
      let codeInterpreterAvailable =
        capabilities.includes(AgentCapabilities.execute_code) === true && !hasAgentSelection;

      if (hasAgentSelection) {
        if (isEphemeralAgent(agentId)) {
          fileSearchAvailable = capabilities.includes(AgentCapabilities.file_search) === true;
          codeInterpreterAvailable = capabilities.includes(AgentCapabilities.execute_code) === true;
        } else if (agent) {
          const agentTools = agent.tools as string[] | undefined;
          fileSearchAvailable =
            capabilities.includes(AgentCapabilities.file_search) === true &&
            (agentTools?.includes('file_search') ?? false);
          codeInterpreterAvailable =
            capabilities.includes(AgentCapabilities.execute_code) === true &&
            (agentTools?.includes('execute_code') ?? false);
        } else {
          fileSearchAvailable = false;
          codeInterpreterAvailable = false;
        }
      }

      const toolResource = resolveChatUploadToolResource({
        codeInterpreterAvailable,
        codeInterpreterEnabled:
          ephemeralAgentRef.current?.[EToolResources.execute_code] === true,
        contextEnabled: capabilities.includes(AgentCapabilities.context) === true,
        fileSearchAvailable,
        fileSearchEnabled: ephemeralAgentRef.current?.[EToolResources.file_search] === true,
        providerUploadFileType: resolveProviderUploadFileType({
          endpoint: currentEndpoint,
          endpointType: currentEndpointType,
          provider: agent?.provider,
          useResponsesApi: conversationRef.current?.useResponsesApi,
        }),
      });

      activateUploadTarget(toolResource);
      handleFilesRef.current(item.files, toolResource);
      setDraggedFiles([]);
      setShowModal(false);
    },
    [activateUploadTarget, isAssistants, localize, queryClient, showToast],
  );

  const [{ canDrop, isOver }, drop] = useDrop(
    () => ({
      accept: [NativeTypes.FILE],
      drop: handleDrop,
      canDrop: () => true,
      collect: (monitor: DropTargetMonitor) => ({
        canDrop: monitor.canDrop(),
        isOver: monitor.isOver(),
      }),
    }),
    [handleDrop],
  );

  return {
    canDrop,
    isOver,
    drop,
    showModal,
    setShowModal,
    draggedFiles,
    handleOptionSelect,
  };
}
