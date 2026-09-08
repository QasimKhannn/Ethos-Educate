import { memo, useMemo, useCallback } from 'react';
import { ContentTypes, FileContext } from 'librechat-data-provider';
import type {
  TMessageContentParts,
  SearchResultData,
  TAttachment,
  Agents,
} from 'librechat-data-provider';
import { MessageContext, SearchContext } from '~/Providers';
import { ParallelContentRenderer, type PartWithIndex } from './ParallelContent';
import { mapAttachments } from '~/utils';
import { EditTextPart, EmptyText } from './Parts';
import MemoryArtifacts from './MemoryArtifacts';
import Sources from '~/components/Web/Sources';
import Container from './Container';
import { getGeneratedDocumentState } from './generatedArtifacts';
import Part from './Part';
import LessonPlanningUnitChoices from './LessonPlanningUnitChoices';

type PartWithContextProps = {
  part: TMessageContentParts;
  idx: number;
  isLastPart: boolean;
  messageId: string;
  conversationId?: string | null;
  nextType?: string;
  isSubmitting: boolean;
  isLatestMessage?: boolean;
  isCreatedByUser: boolean;
  isLast: boolean;
  partAttachments: TAttachment[] | undefined;
  generatedDocumentState: ReturnType<typeof getGeneratedDocumentState>;
  hasImageGenerationResult: boolean;
  onRegenerate?: () => void;
  isRegenerating?: boolean;
};

function isImageGenerationToolCall(part: TMessageContentParts): boolean {
  if (part.type !== ContentTypes.TOOL_CALL) {
    return false;
  }

  const toolCall = part[ContentTypes.TOOL_CALL];
  if (!toolCall || !('name' in toolCall) || typeof toolCall.name !== 'string') {
    return false;
  }

  return toolCall.name.startsWith('generate_image') && toolCall.name.includes('Image_Generation');
}

function isGeneratedImagePart(part: TMessageContentParts): boolean {
  return (
    part.type === ContentTypes.IMAGE_FILE &&
    part[ContentTypes.IMAGE_FILE]?.context === FileContext.image_generation
  );
}

const PartWithContext = memo(function PartWithContext({
  part,
  idx,
  isLastPart,
  messageId,
  conversationId,
  nextType,
  isSubmitting,
  isLatestMessage,
  isCreatedByUser,
  isLast,
  partAttachments,
  generatedDocumentState,
  hasImageGenerationResult,
  onRegenerate,
  isRegenerating,
}: PartWithContextProps) {
  const contextValue = useMemo(
    () => ({
      messageId,
      isExpanded: true as const,
      conversationId,
      partIndex: idx,
      nextType,
      isSubmitting,
      isLatestMessage,
      generatedArtifactExpiries: generatedDocumentState.expiries,
      generatedDocumentToolCallFileIds: generatedDocumentState.toolCallFileIds,
      isGeneratedDocumentToolCall: part.type === ContentTypes.TOOL_CALL,
      onRegenerate,
      isRegenerating,
    }),
    [
      messageId,
      conversationId,
      idx,
      nextType,
      isSubmitting,
      isLatestMessage,
      generatedDocumentState,
      part.type,
      onRegenerate,
      isRegenerating,
    ],
  );

  return (
    <MessageContext.Provider value={contextValue}>
      <Part
        part={part}
        attachments={partAttachments}
        isSubmitting={isSubmitting}
        key={`part-${messageId}-${idx}`}
        isCreatedByUser={isCreatedByUser}
        isLast={isLastPart}
        showCursor={isLastPart && isLast}
        hasImageGenerationResult={hasImageGenerationResult}
      />
    </MessageContext.Provider>
  );
});

type ContentPartsProps = {
  content: Array<TMessageContentParts | undefined> | undefined;
  messageId: string;
  conversationId?: string | null;
  attachments?: TAttachment[];
  searchResults?: { [key: string]: SearchResultData };
  isCreatedByUser: boolean;
  isLast: boolean;
  isSubmitting: boolean;
  isLatestMessage?: boolean;
  edit?: boolean;
  enterEdit?: (cancel?: boolean) => void | null | undefined;
  onRegenerate?: () => void;
  siblingIdx?: number;
  setSiblingIdx?:
    | ((value: number) => void | React.Dispatch<React.SetStateAction<number>>)
    | null
    | undefined;
};

/**
 * ContentParts renders message content parts, handling both sequential and parallel layouts.
 *
 * For 90% of messages (single-agent, no parallel execution), this renders sequentially.
 * For multi-agent parallel execution, it uses ParallelContentRenderer to show columns.
 */
const ContentParts = memo(function ContentParts({
  edit,
  isLast,
  content,
  messageId,
  enterEdit,
  siblingIdx,
  attachments,
  isSubmitting,
  setSiblingIdx,
  searchResults,
  conversationId,
  isCreatedByUser,
  isLatestMessage,
  onRegenerate,
}: ContentPartsProps) {
  const attachmentMap = useMemo(() => mapAttachments(attachments ?? []), [attachments]);
  const generatedDocumentState = useMemo(() => getGeneratedDocumentState(content), [content]);
  const hasImageGenerationResult = useMemo(
    () =>
      content?.some(
        (part) => part && (isImageGenerationToolCall(part) || isGeneratedImagePart(part)),
      ) ?? false,
    [content],
  );
  const effectiveIsSubmitting = isLatestMessage ? isSubmitting : false;

  const renderPart = useCallback(
    (part: TMessageContentParts, idx: number, isLastPart: boolean) => {
      const toolCallId = (part?.[ContentTypes.TOOL_CALL] as Agents.ToolCall | undefined)?.id ?? '';
      return (
        <PartWithContext
          key={`provider-${messageId}-${idx}`}
          idx={idx}
          part={part}
          isLast={isLast}
          messageId={messageId}
          isLastPart={isLastPart}
          conversationId={conversationId}
          isLatestMessage={isLatestMessage}
          isCreatedByUser={isCreatedByUser}
          nextType={content?.[idx + 1]?.type}
          isSubmitting={effectiveIsSubmitting}
          partAttachments={attachmentMap[toolCallId]}
          generatedDocumentState={generatedDocumentState}
          hasImageGenerationResult={hasImageGenerationResult}
          onRegenerate={onRegenerate}
          isRegenerating={isSubmitting}
        />
      );
    },
    [
      attachmentMap,
      content,
      conversationId,
      effectiveIsSubmitting,
      generatedDocumentState,
      hasImageGenerationResult,
      isCreatedByUser,
      isLast,
      isLatestMessage,
      messageId,
      onRegenerate,
      isSubmitting,
    ],
  );

  // Early return: no content
  if (!content) {
    return null;
  }

  // Edit mode: render editable text parts
  if (edit === true && enterEdit && setSiblingIdx) {
    return (
      <>
        {content.map((part, idx) => {
          if (!part) {
            return null;
          }
          const isTextPart =
            part?.type === ContentTypes.TEXT ||
            typeof (part as unknown as Agents.MessageContentText)?.text !== 'string';
          const isThinkPart =
            part?.type === ContentTypes.THINK ||
            typeof (part as unknown as Agents.ReasoningDeltaUpdate)?.think !== 'string';
          if (!isTextPart && !isThinkPart) {
            return null;
          }

          const isToolCall = part.type === ContentTypes.TOOL_CALL || part['tool_call_ids'] != null;
          if (isToolCall) {
            return null;
          }

          return (
            <EditTextPart
              index={idx}
              part={part as Agents.MessageContentText | Agents.ReasoningDeltaUpdate}
              messageId={messageId}
              isSubmitting={isSubmitting}
              enterEdit={enterEdit}
              siblingIdx={siblingIdx ?? null}
              setSiblingIdx={setSiblingIdx}
              key={`edit-${messageId}-${idx}`}
            />
          );
        })}
      </>
    );
  }

  const showEmptyCursor = content.length === 0 && effectiveIsSubmitting;
  const lastContentIdx = content.length - 1;

  // Parallel content: use dedicated renderer with columns (TMessageContentParts includes ContentMetadata)
  const hasParallelContent = content.some((part) => part?.groupId != null);
  if (hasParallelContent) {
    return (
      <ParallelContentRenderer
        content={content}
        messageId={messageId}
        conversationId={conversationId}
        attachments={attachments}
        searchResults={searchResults}
        isSubmitting={effectiveIsSubmitting}
        renderPart={renderPart}
      />
    );
  }

  // Sequential content: render parts in order (90% of cases)
  const sequentialParts: PartWithIndex[] = [];
  content.forEach((part, idx) => {
    if (part) {
      sequentialParts.push({ part, idx });
    }
  });

  return (
    <SearchContext.Provider value={{ searchResults }}>
      <MemoryArtifacts attachments={attachments} />
      <Sources messageId={messageId} conversationId={conversationId || undefined} />
      {showEmptyCursor && (
        <Container>
          <EmptyText />
        </Container>
      )}
      {sequentialParts.map(({ part, idx }) => renderPart(part, idx, idx === lastContentIdx))}
      {!isCreatedByUser && isLatestMessage && (
        <Container>
          <LessonPlanningUnitChoices content={content} isSubmitting={effectiveIsSubmitting} />
        </Container>
      )}
    </SearchContext.Provider>
  );
});

export default ContentParts;
