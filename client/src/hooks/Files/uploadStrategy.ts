import {
  EModelEndpoint,
  EToolResources,
  Providers,
  isDocumentSupportedProvider,
} from 'librechat-data-provider';

export type ChatUploadFileType =
  | 'image'
  | 'document'
  | 'image_document'
  | 'image_document_extended'
  | 'image_document_video_audio';

interface ResolveUploadFileTypeParams {
  endpoint?: string | null;
  endpointType?: string | null;
  provider?: string;
  useResponsesApi?: boolean;
}

interface ResolveUploadToolResourceParams {
  codeInterpreterAvailable: boolean;
  codeInterpreterEnabled: boolean;
  contextEnabled: boolean;
  fileSearchAvailable: boolean;
  fileSearchEnabled: boolean;
  providerUploadFileType: ChatUploadFileType;
}

const normalizeProvider = (provider?: string | null): string | undefined => {
  if (provider?.toLowerCase() === Providers.OPENROUTER) {
    return Providers.OPENROUTER;
  }

  return provider ?? undefined;
};

export const resolveProviderUploadFileType = ({
  endpoint,
  endpointType,
  provider,
  useResponsesApi,
}: ResolveUploadFileTypeParams): ChatUploadFileType => {
  const currentProvider = normalizeProvider(provider ?? endpoint);
  const isAzureWithResponsesApi =
    currentProvider === EModelEndpoint.azureOpenAI && useResponsesApi === true;

  if (
    isDocumentSupportedProvider(endpointType) ||
    isDocumentSupportedProvider(currentProvider) ||
    isAzureWithResponsesApi
  ) {
    if (currentProvider === Providers.GOOGLE || currentProvider === Providers.OPENROUTER) {
      return 'image_document_video_audio';
    }

    if (currentProvider === Providers.BEDROCK || endpointType === EModelEndpoint.bedrock) {
      return 'image_document_extended';
    }

    return 'image_document';
  }

  return 'image';
};

export const resolveChatUploadToolResource = ({
  codeInterpreterAvailable,
  codeInterpreterEnabled,
  contextEnabled,
  fileSearchAvailable,
  fileSearchEnabled,
  providerUploadFileType,
}: ResolveUploadToolResourceParams): EToolResources | undefined => {
  if (codeInterpreterAvailable && codeInterpreterEnabled) {
    return EToolResources.execute_code;
  }

  if (fileSearchAvailable && fileSearchEnabled) {
    return EToolResources.file_search;
  }

  if (providerUploadFileType === 'image' && contextEnabled) {
    return EToolResources.context;
  }

  return undefined;
};
