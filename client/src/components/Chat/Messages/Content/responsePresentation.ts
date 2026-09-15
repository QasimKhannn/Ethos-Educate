import { ContentTypes } from 'librechat-data-provider';
import type { TMessageContentParts } from 'librechat-data-provider';

import { hasInitialStreamingText } from '~/hooks';

type ActiveResponseMessage = {
  isSubmitting: boolean;
  isCreatedByUser?: boolean;
  parentMessageId?: string | null;
  activeUserMessageId?: string | null;
  isLatestMessage?: boolean;
  isLast?: boolean;
};

const getPartText = (value: string | { value?: string } | null | undefined): string | undefined =>
  typeof value === 'string' ? value : value?.value;

export const isActiveResponseMessage = ({
  isSubmitting,
  isCreatedByUser,
  parentMessageId,
  activeUserMessageId,
  isLatestMessage,
  isLast,
}: ActiveResponseMessage): boolean => {
  if (!isSubmitting || isCreatedByUser === true) {
    return false;
  }

  if (activeUserMessageId) {
    return parentMessageId === activeUserMessageId;
  }

  return isLatestMessage === true || isLast === true;
};

export const isInitialResponsePartVisible = (part?: TMessageContentParts): boolean => {
  if (!part) {
    return false;
  }

  if (part.type === ContentTypes.TEXT) {
    const text = getPartText(part.text);
    return typeof text === 'string' && hasInitialStreamingText(text);
  }

  if (part.type === ContentTypes.THINK) {
    const reasoning = getPartText(part.think);
    const visibleReasoning = reasoning
      ?.replace(/^<think>\s*/u, '')
      .replace(/\s*<\/think>$/u, '')
      .trim();
    return Boolean(visibleReasoning);
  }

  if (part.type === ContentTypes.AGENT_UPDATE) {
    return Boolean(part.agent_update?.agentId);
  }

  if (part.type === ContentTypes.ERROR) {
    return Boolean(part.error?.trim() || getPartText(part.text)?.trim());
  }

  if (part.type === ContentTypes.TOOL_CALL) {
    return Boolean(part.tool_call);
  }

  if (part.type === ContentTypes.IMAGE_FILE) {
    return Boolean(part.image_file);
  }

  return false;
};

export const hasInitialResponseContent = (
  content: Array<TMessageContentParts | undefined>,
): boolean => content.some(isInitialResponsePartVisible);
