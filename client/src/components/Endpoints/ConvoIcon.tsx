import React, { useMemo } from 'react';
import { getEndpointField } from 'librechat-data-provider';
import type * as t from 'librechat-data-provider';
import {
  getIconKey,
  getEntity,
  getIconEndpoint,
  isAgentAvatarImageUrl,
  normalizeAgentAvatarUrl,
} from '~/utils';
import ConvoIconURL from '~/components/Endpoints/ConvoIconURL';
import EthosModelMark, { isEthosModelName } from '~/components/Endpoints/EthosModelMark';
import { icons } from '~/hooks/Endpoint/Icons';

export default function ConvoIcon({
  conversation,
  endpointsConfig,
  assistantMap,
  agentsMap,
  className = '',
  containerClassName = '',
  context,
  size,
}: {
  conversation: t.TConversation | t.TPreset | null;
  endpointsConfig: t.TEndpointsConfig;
  assistantMap: t.TAssistantsMap | undefined;
  agentsMap: t.TAgentsMap | undefined;
  containerClassName?: string;
  context?: 'message' | 'nav' | 'landing' | 'menu-item';
  className?: string;
  size?: number;
}) {
  const rawIconURL = conversation?.iconURL ?? '';
  const iconURL = normalizeAgentAvatarUrl(rawIconURL) ?? '';
  let endpoint = conversation?.endpoint;
  endpoint = getIconEndpoint({ endpointsConfig, iconURL: rawIconURL, endpoint });

  const { entity, isAgent } = useMemo(
    () =>
      getEntity({
        endpoint,
        agentsMap,
        assistantMap,
        agent_id: conversation?.agent_id,
        assistant_id: conversation?.assistant_id,
      }),
    [endpoint, conversation?.agent_id, conversation?.assistant_id, agentsMap, assistantMap],
  );

  const name = entity?.name ?? '';
  const avatar = isAgent
    ? (entity as t.Agent | undefined)?.avatar?.filepath
    : ((entity as t.Assistant | undefined)?.metadata?.avatar as string);

  const endpointIconURL = getEndpointField(endpointsConfig, endpoint, 'iconURL');
  const iconKey = getIconKey({ endpoint, endpointsConfig, endpointIconURL });
  const Icon = icons[iconKey] ?? null;

  if (
    isEthosModelName(conversation?.spec) ||
    isEthosModelName(conversation?.modelLabel) ||
    isEthosModelName(conversation?.chatGptLabel)
  ) {
    const ethosContainerClassName =
      context === 'landing'
        ? `${containerClassName} chat-landing-mark-shell-ethos`
        : containerClassName;

    return (
      <div className={ethosContainerClassName}>
        <EthosModelMark
          size={size}
          className={`${className} object-contain`}
          containerClassName="flex h-full w-full items-center justify-center"
        />
      </div>
    );
  }

  return (
    <>
      {isAgentAvatarImageUrl(iconURL) ? (
        <ConvoIconURL
          iconURL={iconURL}
          modelLabel={conversation?.chatGptLabel ?? conversation?.modelLabel ?? ''}
          endpointIconURL={endpointIconURL}
          assistantAvatar={avatar}
          assistantName={name}
          agentAvatar={avatar}
          agentName={name}
          context={context}
        />
      ) : (
        <div className={containerClassName}>
          {endpoint && Icon != null && (
            <Icon
              size={size}
              context={context}
              endpoint={endpoint}
              className={className}
              iconURL={endpointIconURL}
              assistantName={name}
              agentName={name}
              avatar={avatar}
            />
          )}
        </div>
      )}
    </>
  );
}
