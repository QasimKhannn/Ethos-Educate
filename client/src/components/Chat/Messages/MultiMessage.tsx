import { useRecoilState } from 'recoil';
import { useEffect, useCallback, useMemo } from 'react';
import { isAssistantsEndpoint } from 'librechat-data-provider';
import type { TMessage } from 'librechat-data-provider';
import type { TMessageProps } from '~/common';
import MessageContent from '~/components/Messages/MessageContent';
import MessageParts from './MessageParts';
import Message from './Message';
import store from '~/store';
import { filterStaleToolCallSiblings } from '~/utils';

export default function MultiMessage({
  // messageId is used recursively here
  messageId,
  messagesTree,
  currentEditId,
  setCurrentEditId,
}: TMessageProps) {
  const [siblingIdx, setSiblingIdx] = useRecoilState(store.messagesSiblingIdxFamily(messageId));
  const visibleMessagesTree = useMemo(
    () => filterStaleToolCallSiblings(messagesTree),
    [messagesTree],
  );

  const setSiblingIdxRev = useCallback(
    (value: number) => {
      setSiblingIdx((visibleMessagesTree?.length ?? 0) - value - 1);
    },
    [visibleMessagesTree?.length, setSiblingIdx],
  );

  useEffect(() => {
    // reset siblingIdx when the tree changes, mostly when a new message is submitting.
    setSiblingIdx(0);
  }, [visibleMessagesTree?.length, setSiblingIdx]);

  useEffect(() => {
    if (visibleMessagesTree?.length && siblingIdx >= visibleMessagesTree.length) {
      setSiblingIdx(0);
    }
  }, [siblingIdx, visibleMessagesTree?.length, setSiblingIdx]);

  if (!(visibleMessagesTree && visibleMessagesTree.length)) {
    return null;
  }

  const message = visibleMessagesTree[visibleMessagesTree.length - siblingIdx - 1] as
    | TMessage
    | undefined;

  if (!message) {
    return null;
  }

  if (isAssistantsEndpoint(message.endpoint) && message.content) {
    return (
      <MessageParts
        key={message.messageId}
        message={message}
        currentEditId={currentEditId}
        setCurrentEditId={setCurrentEditId}
        siblingIdx={visibleMessagesTree.length - siblingIdx - 1}
        siblingCount={visibleMessagesTree.length}
        setSiblingIdx={setSiblingIdxRev}
      />
    );
  } else if (message.content) {
    return (
      <MessageContent
        key={message.messageId}
        message={message}
        currentEditId={currentEditId}
        setCurrentEditId={setCurrentEditId}
        siblingIdx={visibleMessagesTree.length - siblingIdx - 1}
        siblingCount={visibleMessagesTree.length}
        setSiblingIdx={setSiblingIdxRev}
      />
    );
  }

  return (
    <Message
      key={message.messageId}
      message={message}
      currentEditId={currentEditId}
      setCurrentEditId={setCurrentEditId}
      siblingIdx={visibleMessagesTree.length - siblingIdx - 1}
      siblingCount={visibleMessagesTree.length}
      setSiblingIdx={setSiblingIdxRev}
    />
  );
}
