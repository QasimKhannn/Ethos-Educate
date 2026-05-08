type ConversationPage<T extends { conversationId?: string | null }> = {
  conversations: T[];
};

export const flattenUniqueConversations = <T extends { conversationId?: string | null }>(
  pages?: Array<ConversationPage<T>>,
): T[] => {
  const conversations: T[] = [];
  const seenConversationIds = new Set<string>();

  if (!pages) {
    return conversations;
  }

  for (const page of pages) {
    for (const conversation of page.conversations) {
      const conversationId = conversation.conversationId;
      if (!conversationId || seenConversationIds.has(conversationId)) {
        continue;
      }
      seenConversationIds.add(conversationId);
      conversations.push(conversation);
    }
  }

  return conversations;
};
