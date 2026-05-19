import { useMemo } from 'react';
import { UserIcon } from '@librechat/client';
import type { TMessage, Assistant, Agent } from 'librechat-data-provider';
import type { TMessageProps } from '~/common';
import MessageEndpointIcon from '../Endpoints/MessageEndpointIcon';
import ConvoIconURL from '~/components/Endpoints/ConvoIconURL';
import {
  getAgentAvatarImageUrl,
  getAgentDisplayName,
  getIconEndpoint,
  isAgentAvatarImageUrl,
  logger,
  normalizeAgentAvatarUrl,
} from '~/utils';

export default function MessageIcon(
  props: Pick<TMessageProps, 'message' | 'conversation'> & {
    assistant?: false | Assistant;
    agent?: false | Agent;
  },
) {
  const { message, conversation, assistant, agent } = props;

  const messageSettings = useMemo(
    () => ({
      ...(conversation ?? {}),
      ...({
        ...message,
        iconURL: message?.iconURL ?? '',
      } as TMessage),
    }),
    [conversation, message],
  );

  const rawIconURL = messageSettings.iconURL ?? '';
  const iconURL = normalizeAgentAvatarUrl(rawIconURL) ?? rawIconURL;
  let endpoint = messageSettings.endpoint;
  endpoint = getIconEndpoint({ endpointsConfig: undefined, iconURL: rawIconURL, endpoint });
  const assistantName = (assistant ? assistant.name : '') ?? '';
  const assistantAvatar =
    normalizeAgentAvatarUrl((assistant ? (assistant.metadata?.avatar as string) : null) ?? null) ??
    '';
  const agentName = agent ? getAgentDisplayName(agent) : '';
  const agentAvatar = getAgentAvatarImageUrl(agent || null) ?? '';
  const avatarURL = useMemo(() => {
    let result = '';
    if (assistant) {
      result = assistantAvatar;
    } else if (agent) {
      result = agentAvatar;
    }
    return result;
  }, [assistant, agent, assistantAvatar, agentAvatar]);
  logger.log('MessageIcon', {
    endpoint,
    iconURL,
    assistantName,
    assistantAvatar,
    agentName,
    agentAvatar,
  });
  const displayIconURL = agentAvatar || iconURL;
  if (message?.isCreatedByUser !== true && isAgentAvatarImageUrl(displayIconURL)) {
    return (
      <ConvoIconURL
        iconURL={displayIconURL}
        modelLabel={messageSettings.chatGptLabel ?? messageSettings.modelLabel ?? ''}
        context="message"
        assistantAvatar={assistantAvatar}
        assistantName={assistantName}
        agentAvatar={agentAvatar}
        agentName={agentName}
      />
    );
  }

  if (message?.isCreatedByUser === true) {
    return (
      <div
        style={{
          backgroundColor: 'rgb(121, 137, 255)',
          width: '20px',
          height: '20px',
          boxShadow: 'rgba(240, 246, 252, 0.1) 0px 0px 0px 1px',
        }}
        className="relative flex h-9 w-9 items-center justify-center rounded-sm p-1 text-white"
      >
        <UserIcon />
      </div>
    );
  }

  return (
    <MessageEndpointIcon
      {...messageSettings}
      endpoint={endpoint}
      iconURL={avatarURL}
      model={message?.model ?? conversation?.model}
      assistantName={assistantName}
      agentName={agentName}
      size={28.8}
    />
  );
}
