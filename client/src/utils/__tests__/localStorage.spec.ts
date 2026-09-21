import { Constants, LocalStorageKeys } from 'librechat-data-provider';
import { transferMCPSelection } from '../localStorage';

describe('transferMCPSelection', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('moves a new chat MCP selection to the created conversation', () => {
    const sourceKey = `${LocalStorageKeys.LAST_MCP_}${Constants.NEW_CONVO}`;
    const targetConversationId = 'conversation-123';
    const targetKey = `${LocalStorageKeys.LAST_MCP_}${targetConversationId}`;

    localStorage.setItem(sourceKey, JSON.stringify(['Document Workflow', 'websearch']));

    transferMCPSelection(Constants.NEW_CONVO, targetConversationId);

    expect(localStorage.getItem(targetKey)).toBe(
      JSON.stringify(['Document Workflow', 'websearch']),
    );
    expect(localStorage.getItem(`${targetKey}_TIMESTAMP`)).toBeTruthy();
  });

  it('preserves an explicit empty selection', () => {
    const sourceKey = `${LocalStorageKeys.LAST_MCP_}${Constants.NEW_CONVO}`;
    const targetConversationId = 'conversation-123';
    const targetKey = `${LocalStorageKeys.LAST_MCP_}${targetConversationId}`;

    localStorage.setItem(sourceKey, JSON.stringify([]));

    transferMCPSelection(Constants.NEW_CONVO, targetConversationId);

    expect(localStorage.getItem(targetKey)).toBe(JSON.stringify([]));
  });

  it('does not transfer malformed saved data', () => {
    const sourceKey = `${LocalStorageKeys.LAST_MCP_}${Constants.NEW_CONVO}`;
    const targetConversationId = 'conversation-123';
    const targetKey = `${LocalStorageKeys.LAST_MCP_}${targetConversationId}`;

    localStorage.setItem(sourceKey, JSON.stringify({ serverName: 'Document Workflow' }));

    transferMCPSelection(Constants.NEW_CONVO, targetConversationId);

    expect(localStorage.getItem(targetKey)).toBeNull();
  });
});
