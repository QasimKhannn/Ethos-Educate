import { useEffect, useMemo } from 'react';
import { useRecoilState } from 'recoil';
import type { TMessage } from 'librechat-data-provider';
import type { TMessageProps } from '~/common';

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

  const setSiblingIdxRev = (value: number) => {
    setSiblingIdx((visibleMessagesTree?.length ?? 0) - value - 1);
  };

  useEffect(() => {
    // reset siblingIdx when the tree changes, mostly when a new message is submitting.
    setSiblingIdx(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleMessagesTree?.length]);

  useEffect(() => {
    if (visibleMessagesTree?.length != null && siblingIdx >= visibleMessagesTree.length) {
      setSiblingIdx(0);
    }
  }, [siblingIdx, visibleMessagesTree?.length, setSiblingIdx]);

  if (!(visibleMessagesTree && visibleMessagesTree.length)) {
    return null;
  }

  const message = visibleMessagesTree[
    visibleMessagesTree.length - siblingIdx - 1
  ] as TMessage | null;
  if (!message) {
    return null;
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
