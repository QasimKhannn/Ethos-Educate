import { getEndpointField, isAssistantsEndpoint } from 'librechat-data-provider';
import type {
  TPreset,
  TConversation,
  TAssistantsMap,
  TEndpointsConfig,
} from 'librechat-data-provider';
import ConvoIconURL from '~/components/Endpoints/ConvoIconURL';
import EthosModelMark, { isEthosModelName } from '~/components/Endpoints/EthosModelMark';
import MinimalIcon from '~/components/Endpoints/MinimalIcon';
import { getIconEndpoint, isAgentAvatarImageUrl, normalizeAgentAvatarUrl } from '~/utils';

export default function EndpointIcon({
  conversation,
  endpointsConfig,
  className = 'mr-0',
  assistantMap,
  context,
}: {
  conversation: TConversation | TPreset | null;
  endpointsConfig: TEndpointsConfig;
  containerClassName?: string;
  context?: 'message' | 'nav' | 'landing' | 'menu-item';
  assistantMap?: TAssistantsMap;
  className?: string;
  size?: number;
}) {
  const rawConvoIconURL = conversation?.iconURL ?? '';
  const convoIconURL = normalizeAgentAvatarUrl(rawConvoIconURL) ?? '';
  let endpoint = conversation?.endpoint;
  endpoint = getIconEndpoint({ endpointsConfig, iconURL: rawConvoIconURL, endpoint });

  const endpointType = getEndpointField(endpointsConfig, endpoint, 'type');
  const endpointIconURL = getEndpointField(endpointsConfig, endpoint, 'iconURL');

  const assistant = isAssistantsEndpoint(endpoint)
    ? assistantMap?.[endpoint]?.[conversation?.assistant_id ?? '']
    : null;
  const assistantAvatar =
    normalizeAgentAvatarUrl((assistant && (assistant.metadata?.avatar as string)) || null) ?? '';
  const assistantName = assistant && (assistant.name ?? '');

  const iconURL = assistantAvatar || convoIconURL;

  if (isAgentAvatarImageUrl(iconURL)) {
    return (
      <ConvoIconURL
        iconURL={iconURL}
        modelLabel={conversation?.chatGptLabel ?? conversation?.modelLabel ?? ''}
        context={context}
        endpointIconURL={endpointIconURL}
        assistantAvatar={assistantAvatar}
        assistantName={assistantName ?? ''}
      />
    );
  }

  if (
    isEthosModelName(conversation?.spec) ||
    isEthosModelName(conversation?.modelLabel) ||
    isEthosModelName(conversation?.chatGptLabel)
  ) {
    return <EthosModelMark />;
  }

  return (
    <MinimalIcon
      size={20}
      iconURL={endpointIconURL}
      endpoint={endpoint}
      endpointType={endpointType}
      model={conversation?.model}
      error={false}
      className={className}
      isCreatedByUser={false}
      chatGptLabel={undefined}
      modelLabel={undefined}
    />
  );
}
