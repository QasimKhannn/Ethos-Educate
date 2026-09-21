import { LocalStorageKeys, TConversation, isUUID } from 'librechat-data-provider';
import { setTimestamp } from './timestamps';

const isMCPServerList = (value: unknown): value is string[] => {
  return Array.isArray(value) && value.every((serverName) => typeof serverName === 'string');
};

export function transferMCPSelection(
  sourceConversationId: string | null | undefined,
  targetConversationId: string | null | undefined,
): void {
  if (
    !sourceConversationId ||
    !targetConversationId ||
    sourceConversationId === targetConversationId
  ) {
    return;
  }

  const sourceKey = `${LocalStorageKeys.LAST_MCP_}${sourceConversationId}`;
  const storedSelection = localStorage.getItem(sourceKey);
  if (storedSelection === null) {
    return;
  }

  try {
    const selection: unknown = JSON.parse(storedSelection);
    if (!isMCPServerList(selection)) {
      return;
    }

    const targetKey = `${LocalStorageKeys.LAST_MCP_}${targetConversationId}`;
    localStorage.setItem(targetKey, JSON.stringify(selection));
    setTimestamp(targetKey);
  } catch {
    return;
  }
}

export function getLocalStorageItems() {
  const items = {
    lastSelectedModel: localStorage.getItem(LocalStorageKeys.LAST_MODEL) ?? '',
    lastSelectedTools: localStorage.getItem(LocalStorageKeys.LAST_TOOLS) ?? '',
    lastConversationSetup: localStorage.getItem(LocalStorageKeys.LAST_CONVO_SETUP + '_0') ?? '',
  };

  const lastSelectedModel = items.lastSelectedModel
    ? (JSON.parse(items.lastSelectedModel) as Record<string, string | undefined> | null)
    : {};
  const lastSelectedTools = items.lastSelectedTools
    ? (JSON.parse(items.lastSelectedTools) as string[] | null)
    : [];
  const lastConversationSetup = items.lastConversationSetup
    ? (JSON.parse(items.lastConversationSetup) as Partial<TConversation> | null)
    : {};

  return {
    lastSelectedModel,
    lastSelectedTools,
    lastConversationSetup,
  };
}

export function clearLocalStorage(skipFirst?: boolean) {
  const keys = Object.keys(localStorage);
  keys.forEach((key) => {
    if (skipFirst === true && key.endsWith('0')) {
      return;
    }
    if (
      key.startsWith(LocalStorageKeys.LAST_MCP_) ||
      key.startsWith(LocalStorageKeys.LAST_CODE_TOGGLE_) ||
      key.startsWith(LocalStorageKeys.ASST_ID_PREFIX) ||
      key.startsWith(LocalStorageKeys.AGENT_ID_PREFIX) ||
      key.startsWith(LocalStorageKeys.LAST_CONVO_SETUP) ||
      key === LocalStorageKeys.LAST_SPEC ||
      key === LocalStorageKeys.LAST_TOOLS ||
      key === LocalStorageKeys.LAST_MODEL ||
      key === LocalStorageKeys.FILES_TO_DELETE
    ) {
      localStorage.removeItem(key);
    }
  });
}

export function clearConversationStorage(conversationId?: string | null) {
  if (!conversationId) {
    return;
  }
  if (!isUUID.safeParse(conversationId)?.success) {
    console.warn(
      `Conversation ID ${conversationId} is not a valid UUID. Skipping local storage cleanup.`,
    );
    return;
  }
  const keys = Object.keys(localStorage);
  keys.forEach((key) => {
    if (key.includes(conversationId)) {
      localStorage.removeItem(key);
    }
  });
}
export function clearAllConversationStorage() {
  const keys = Object.keys(localStorage);
  keys.forEach((key) => {
    if (
      key.startsWith(LocalStorageKeys.LAST_MCP_) ||
      key.startsWith(LocalStorageKeys.LAST_CODE_TOGGLE_) ||
      key.startsWith(LocalStorageKeys.TEXT_DRAFT) ||
      key.startsWith(LocalStorageKeys.ASST_ID_PREFIX) ||
      key.startsWith(LocalStorageKeys.AGENT_ID_PREFIX) ||
      key.startsWith(LocalStorageKeys.LAST_CONVO_SETUP)
    ) {
      localStorage.removeItem(key);
    }
  });
}
