import React, { useMemo, useRef, useState } from 'react';
import { useRecoilState } from 'recoil';
import { FileImageIcon } from 'lucide-react';
import {
  AttachmentIcon,
  DropdownPopup,
  FileUpload,
  SharePointIcon,
  TooltipAnchor,
} from '@librechat/client';
import {
  EToolResources,
  defaultAgentCapabilities,
  bedrockDocumentExtensions,
} from 'librechat-data-provider';
import type { EndpointFileConfig } from 'librechat-data-provider';
import {
  useAgentCapabilities,
  useAgentToolPermissions,
  useFileHandling,
  useGetAgentsConfig,
  useLocalize,
} from '~/hooks';
import type { ChatUploadFileType } from '~/hooks/Files/uploadStrategy';
import {
  resolveChatUploadToolResource,
  resolveProviderUploadFileType,
} from '~/hooks/Files/uploadStrategy';
import useSharePointFileHandling from '~/hooks/Files/useSharePointFileHandling';
import { SharePointPickerDialog } from '~/components/SharePoint';
import { useGetStartupConfig } from '~/data-provider';
import { ephemeralAgentByConvoId } from '~/store';
import type { MenuItemProps } from '~/common';
import { cn } from '~/utils';

interface AttachFileMenuProps {
  agentId?: string | null;
  endpoint?: string | null;
  disabled?: boolean | null;
  conversationId: string;
  endpointType?: string | null;
  endpointFileConfig?: EndpointFileConfig;
  useResponsesApi?: boolean;
}

const AttachFileMenu = ({
  agentId,
  endpoint,
  disabled,
  endpointType,
  conversationId,
  endpointFileConfig,
  useResponsesApi,
}: AttachFileMenuProps) => {
  const localize = useLocalize();
  const isUploadDisabled = disabled ?? false;
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPopoverActive, setIsPopoverActive] = useState(false);
  const [ephemeralAgent, setEphemeralAgent] = useRecoilState(
    ephemeralAgentByConvoId(conversationId),
  );
  const [toolResource, setToolResource] = useState<EToolResources | undefined>();
  const { handleFileChange } = useFileHandling();
  const { handleSharePointFiles, isProcessing, downloadProgress } = useSharePointFileHandling({
    toolResource,
  });
  const { agentsConfig } = useGetAgentsConfig();
  const { data: startupConfig } = useGetStartupConfig();
  const sharePointEnabled = startupConfig?.sharePointFilePickerEnabled === true;
  const [isSharePointDialogOpen, setIsSharePointDialogOpen] = useState(false);
  const capabilities = useAgentCapabilities(agentsConfig?.capabilities ?? defaultAgentCapabilities);
  const { fileSearchAllowedByAgent, codeAllowedByAgent, provider } = useAgentToolPermissions(
    agentId,
    ephemeralAgent,
  );
  const hasAgentSelection = agentId != null && agentId !== '';
  const fileSearchAvailable =
    capabilities.fileSearchEnabled && (!hasAgentSelection || fileSearchAllowedByAgent);
  const codeInterpreterAvailable =
    capabilities.codeEnabled && (!hasAgentSelection || codeAllowedByAgent);

  const providerUploadFileType = useMemo(
    () =>
      resolveProviderUploadFileType({
        endpoint,
        endpointType,
        provider,
        useResponsesApi,
      }),
    [endpoint, endpointType, provider, useResponsesApi],
  );

  const unifiedToolResource = useMemo(
    () =>
      resolveChatUploadToolResource({
        codeInterpreterAvailable,
        codeInterpreterEnabled: ephemeralAgent?.[EToolResources.execute_code] === true,
        contextEnabled: capabilities.contextEnabled,
        fileSearchAvailable,
        fileSearchEnabled: ephemeralAgent?.[EToolResources.file_search] === true,
        providerUploadFileType,
      }),
    [
      capabilities.contextEnabled,
      codeInterpreterAvailable,
      ephemeralAgent,
      fileSearchAvailable,
      providerUploadFileType,
    ],
  );

  const handleUploadClick = (fileType?: ChatUploadFileType) => {
    if (!inputRef.current) {
      return;
    }

    inputRef.current.value = '';
    if (fileType === 'image') {
      inputRef.current.accept = 'image/*,.heif,.heic';
    } else if (fileType === 'document') {
      inputRef.current.accept = '.pdf,application/pdf';
    } else if (fileType === 'image_document') {
      inputRef.current.accept = 'image/*,.heif,.heic,.pdf,application/pdf';
    } else if (fileType === 'image_document_extended') {
      inputRef.current.accept = `image/*,.heif,.heic,${bedrockDocumentExtensions}`;
    } else if (fileType === 'image_document_video_audio') {
      inputRef.current.accept = 'image/*,.heif,.heic,.pdf,application/pdf,video/*,audio/*';
    } else {
      inputRef.current.accept = '';
    }

    inputRef.current.click();
    inputRef.current.accept = '';
  };

  const activateUploadTarget = (nextToolResource?: EToolResources) => {
    setToolResource(nextToolResource);
    if (nextToolResource == null) {
      return;
    }

    setEphemeralAgent((prev) => ({
      ...(prev ?? {}),
      [nextToolResource]: true,
    }));
  };

  const handleUnifiedUploadClick = () => {
    activateUploadTarget(unifiedToolResource);
    if (unifiedToolResource == null) {
      handleUploadClick(providerUploadFileType);
      return;
    }

    handleUploadClick();
  };

  const dropdownItems = useMemo<MenuItemProps[]>(
    () =>
      sharePointEnabled
        ? [
            {
              label: localize('com_ui_upload_files'),
              onClick: handleUnifiedUploadClick,
              icon: <FileImageIcon className="icon-md" />,
            },
            {
              label: localize('com_files_upload_sharepoint'),
              onClick: () => {
                activateUploadTarget(unifiedToolResource);
                setIsSharePointDialogOpen(true);
              },
              icon: <SharePointIcon className="icon-md" />,
            },
          ]
        : [],
    [handleUnifiedUploadClick, localize, sharePointEnabled, unifiedToolResource],
  );

  const triggerButton = (
    <TooltipAnchor
      render={
        <button
          type="button"
          disabled={isUploadDisabled}
          id="attach-file-menu-button"
          aria-label={localize('com_sidepanel_attach_files')}
          className={cn(
            'flex size-9 items-center justify-center rounded-full p-1 hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-opacity-50',
            isPopoverActive && 'bg-surface-hover',
          )}
          onClick={sharePointEnabled ? undefined : handleUnifiedUploadClick}
        >
          <div className="flex w-full items-center justify-center gap-2">
            <AttachmentIcon />
          </div>
        </button>
      }
      id="attach-file-menu-button"
      description={localize('com_ui_tooltip_attach_files')}
      disabled={isUploadDisabled}
    />
  );

  const handleSharePointFilesSelected = async (sharePointFiles: unknown[]) => {
    try {
      await handleSharePointFiles(sharePointFiles);
      setIsSharePointDialogOpen(false);
    } catch (error) {
      console.error('SharePoint file processing error:', error);
    }
  };

  return (
    <>
      <FileUpload
        ref={inputRef}
        handleFileChange={(e) => {
          handleFileChange(e, toolResource);
        }}
      >
        {sharePointEnabled ? (
          <DropdownPopup
            menuId="attach-file-menu"
            className="overflow-visible"
            isOpen={isPopoverActive}
            setIsOpen={setIsPopoverActive}
            modal={true}
            unmountOnHide={true}
            trigger={triggerButton}
            items={dropdownItems}
            iconClassName="mr-0"
          />
        ) : (
          triggerButton
        )}
      </FileUpload>
      <SharePointPickerDialog
        isOpen={isSharePointDialogOpen}
        onOpenChange={setIsSharePointDialogOpen}
        onFilesSelected={handleSharePointFilesSelected}
        isDownloading={isProcessing}
        downloadProgress={downloadProgress}
        maxSelectionCount={endpointFileConfig?.fileLimit}
      />
    </>
  );
};

export default React.memo(AttachFileMenu);
