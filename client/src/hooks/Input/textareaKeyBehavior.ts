interface EnterKeyBehaviorParams {
  ctrlKey: boolean;
  enterToSend: boolean;
  isSmallScreen: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}

export function shouldInsertNewlineOnEnter({
  ctrlKey,
  enterToSend,
  isSmallScreen,
  metaKey,
  shiftKey,
}: EnterKeyBehaviorParams): boolean {
  if (ctrlKey || metaKey) {
    return false;
  }

  if (!enterToSend) {
    return true;
  }

  return isSmallScreen && !shiftKey;
}
