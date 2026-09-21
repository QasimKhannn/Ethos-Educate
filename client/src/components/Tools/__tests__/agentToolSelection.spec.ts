import { Constants } from 'librechat-data-provider';
import {
  addMCPToolToAgent,
  getMCPServerName,
  isMCPToolSelected,
  removeMCPToolFromAgent,
} from '../agentToolSelection';

const serverName = 'downloadable-files';
const firstTool = `create_document${Constants.mcp_delimiter}${serverName}`;
const secondTool = `create_pdf${Constants.mcp_delimiter}${serverName}`;
const serverMarker = `${Constants.mcp_server}${Constants.mcp_delimiter}${serverName}`;
const allToolsMarker = `${Constants.mcp_all}${Constants.mcp_delimiter}${serverName}`;

describe('agentToolSelection', () => {
  it('adds a single tool and the server marker without selecting its sibling tools', () => {
    expect(addMCPToolToAgent([], serverName, firstTool)).toEqual([serverMarker, firstTool]);
  });

  it('keeps the server marker until the final selected tool is removed', () => {
    const selectedTools = [serverMarker, firstTool, secondTool];

    expect(
      removeMCPToolFromAgent(selectedTools, serverName, firstTool, [firstTool, secondTool]),
    ).toEqual([serverMarker, secondTool]);
    expect(
      removeMCPToolFromAgent([serverMarker, firstTool], serverName, firstTool, [firstTool]),
    ).toEqual([]);
  });

  it('converts an existing all-tools selection when one tool is unchecked', () => {
    expect(isMCPToolSelected([allToolsMarker], serverName, firstTool)).toBe(true);
    expect(
      removeMCPToolFromAgent([allToolsMarker], serverName, firstTool, [firstTool, secondTool]),
    ).toEqual([serverMarker, secondTool]);
  });

  it('extracts the server name from an MCP tool identifier', () => {
    expect(getMCPServerName(firstTool)).toBe(serverName);
    expect(getMCPServerName('web_search')).toBeUndefined();
  });
});
