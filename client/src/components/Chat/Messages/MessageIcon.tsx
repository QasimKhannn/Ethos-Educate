import React, { useMemo, memo } from 'react';
import { getEndpointField } from 'librechat-data-provider';
import type { Assistant, Agent } from 'librechat-data-provider';
import type { TMessageIcon } from '~/common';
import ConvoIconURL from '~/components/Endpoints/ConvoIconURL';
import { useGetEndpointsQuery } from '~/data-provider';
import {
  getAgentAvatarImageUrl,
  getAgentDisplayName,
  getIconEndpoint,
  isAgentAvatarImageUrl,
  logger,
  normalizeAgentAvatarUrl,
} from '~/utils';
import Icon from '~/components/Endpoints/Icon';

const MessageIcon = memo(
  ({
    iconData,
    assistant,
    agent,
  }: {
    iconData?: TMessageIcon;
    assistant?: Assistant;
    agent?: Agent;
  }) => {
    logger.log('icon_data', iconData, assistant, agent);
    const { data: endpointsConfig } = useGetEndpointsQuery();

    const agentName = useMemo(() => getAgentDisplayName(agent), [agent]);
    const agentAvatar = useMemo(() => getAgentAvatarImageUrl(agent) ?? '', [agent]);
    const assistantName = useMemo(() => assistant?.name ?? '', [assistant]);
    const assistantAvatar = useMemo(
      () =>
        normalizeAgentAvatarUrl((assistant?.metadata?.avatar as string | undefined) ?? null) ?? '',
      [assistant],
    );

    const avatarURL = useMemo(() => {
      let result = '';
      if (assistant) {
        result = assistantAvatar;
      } else if (agent) {
        result = agentAvatar;
      }
      return result;
    }, [assistant, agent, assistantAvatar, agentAvatar]);

    const iconURL = useMemo(
      () => normalizeAgentAvatarUrl(iconData?.iconURL ?? null) ?? iconData?.iconURL,
      [iconData?.iconURL],
    );
    const endpoint = useMemo(
      () => getIconEndpoint({ endpointsConfig, iconURL, endpoint: iconData?.endpoint }),
      [endpointsConfig, iconURL, iconData?.endpoint],
    );

    const endpointIconURL = useMemo(
      () => getEndpointField(endpointsConfig, endpoint, 'iconURL'),
      [endpointsConfig, endpoint],
    );

    const displayIconURL = agentAvatar || iconURL;
    if (iconData?.isCreatedByUser !== true && isAgentAvatarImageUrl(displayIconURL)) {
      return (
        <ConvoIconURL
          iconURL={displayIconURL}
          modelLabel={iconData?.modelLabel}
          context="message"
          assistantAvatar={assistantAvatar}
          agentAvatar={agentAvatar}
          endpointIconURL={endpointIconURL}
          assistantName={assistantName}
          agentName={agentName}
        />
      );
    }

    return (
      <Icon
        isCreatedByUser={iconData?.isCreatedByUser ?? false}
        endpoint={endpoint}
        iconURL={avatarURL || endpointIconURL}
        model={iconData?.model}
        assistantName={assistantName}
        agentName={agentName}
        size={28.8}
      />
    );
  },
);

MessageIcon.displayName = 'MessageIcon';

export default MessageIcon;
