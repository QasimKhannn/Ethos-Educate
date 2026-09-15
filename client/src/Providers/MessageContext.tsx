import { createContext, useContext } from 'react';

import type {
  GeneratedArtifactExpiries,
  GeneratedDocumentState,
} from '~/components/Chat/Messages/Content/generatedArtifacts';

type MessageContext = {
  messageId: string;
  nextType?: string;
  partIndex?: number;
  isExpanded: boolean;
  conversationId?: string | null;
  /** Submission state for cursor display - only true for latest message when submitting */
  isSubmitting?: boolean;
  /** Whether this is the latest message in the conversation */
  isLatestMessage?: boolean;
  /** Whether incoming text should be progressively revealed for this live response */
  smoothStreaming?: boolean;
  /** Retention times extracted from generated-document output in this message. */
  generatedArtifactExpiries?: GeneratedArtifactExpiries;
  /** Managed files supplied by a tool result, rendered once at that source. */
  generatedDocumentToolCallFileIds?: GeneratedDocumentState['toolCallFileIds'];
  /** Whether this content part is the tool result that owns generated file cards. */
  isGeneratedDocumentToolCall?: boolean;
  /** Replays this assistant turn to create a fresh generated artifact. */
  onRegenerate?: () => void;
  /** Prevents duplicate regeneration requests while this turn is running. */
  isRegenerating?: boolean;
};

export const MessageContext = createContext<MessageContext>({} as MessageContext);
export const useMessageContext = () => useContext(MessageContext);
