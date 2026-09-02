import type { MCPServersListResponse } from 'librechat-data-provider';
import { getAutoSelectedMCPServerNames } from '../autoSelect';

const createServer = (
  overrides: Partial<MCPServersListResponse[string]> = {},
): MCPServersListResponse[string] => ({
  type: 'sse',
  url: 'https://mcp.example.com/sse',
  ...overrides,
});

describe('getAutoSelectedMCPServerNames', () => {
  it('selects an MCP when the prompt mentions the server name', () => {
    const servers: MCPServersListResponse = {
      sharepoint: createServer({ title: 'SharePoint' }),
      slack: createServer({ title: 'Slack' }),
    };

    expect(
      getAutoSelectedMCPServerNames({
        servers,
        prompt: 'Can you search for my file in SharePoint?',
      }),
    ).toEqual(['sharepoint']);
  });

  it('does not automatically select an authenticated MCP even when its name is requested', () => {
    const servers: MCPServersListResponse = {
      sharepoint: createServer({ title: 'SharePoint', requiresOAuth: true }),
      onedrive: createServer({ title: 'OneDrive', requiresOAuth: true }),
      outlook: createServer({ title: 'Outlook', requiresOAuth: true }),
    };

    expect(
      getAutoSelectedMCPServerNames({
        servers,
        prompt: 'Search SharePoint and OneDrive, then check my Outlook email.',
      }),
    ).toEqual([]);
  });

  it('does not automatically select tools that require user-provided credentials', () => {
    const servers: MCPServersListResponse = {
      privateKnowledgeBase: createServer({
        title: 'Private Knowledge Base',
        apiKey: {
          source: 'user',
          authorization_type: 'bearer',
        },
      }),
    };

    expect(
      getAutoSelectedMCPServerNames({
        servers,
        prompt: 'Search my private knowledge base.',
      }),
    ).toEqual([]);
  });

  it('does not select tools for a tool-inventory question', () => {
    const servers: MCPServersListResponse = {
      sharepoint: createServer({ title: 'SharePoint', requiresOAuth: true }),
      imageGeneration: createServer({ title: 'Image Generation' }),
      webSearch: createServer({ title: 'Web Search' }),
    };

    expect(
      getAutoSelectedMCPServerNames({
        servers,
        prompt: 'What tools and MCPs do you have?',
      }),
    ).toEqual([]);
  });

  it('matches compact names when users type them as separate words', () => {
    const servers: MCPServersListResponse = {
      onedrive: createServer({ title: 'OneDrive' }),
    };

    expect(
      getAutoSelectedMCPServerNames({
        servers,
        prompt: 'Find the spreadsheet in one drive',
      }),
    ).toEqual(['onedrive']);
  });

  it('selects multiple compound MCP names from one prompt', () => {
    const servers: MCPServersListResponse = {
      microsoftSharePoint: createServer({ title: 'Microsoft SharePoint' }),
      microsoftOneDrive: createServer({ title: 'Microsoft OneDrive' }),
      slack: createServer({ title: 'Slack' }),
    };

    expect(
      getAutoSelectedMCPServerNames({
        servers,
        prompt: 'Search my SharePoint and OneDrive for this file',
      }),
    ).toEqual(['microsoftSharePoint', 'microsoftOneDrive']);
  });

  it('does not select servers from generic search and file terms', () => {
    const servers: MCPServersListResponse = {
      sharepoint: createServer({ description: 'Search files and documents in SharePoint' }),
    };

    expect(
      getAutoSelectedMCPServerNames({
        servers,
        prompt: 'Can you search my files?',
      }),
    ).toEqual([]);
  });

  it('does not select every creation-related server from a generic create request', () => {
    const servers: MCPServersListResponse = {
      downloadableFiles: createServer({ description: 'Create Microsoft Office documents' }),
      podcastAudio: createServer({ description: 'Create MP3 podcast audio from text' }),
      imageGeneration: createServer({ description: 'Generate AI images' }),
    };

    expect(
      getAutoSelectedMCPServerNames({
        servers,
        prompt: 'Create a poster for Multicultural Literacy Night.',
      }),
    ).toEqual([]);
  });

  it('selects image generation without adding unrelated creation tools', () => {
    const servers: MCPServersListResponse = {
      downloadableFiles: createServer({ description: 'Create Microsoft Office documents' }),
      podcastAudio: createServer({ description: 'Create MP3 podcast audio from text' }),
      imageGeneration: createServer({ description: 'Generate AI images' }),
    };

    expect(
      getAutoSelectedMCPServerNames({
        servers,
        prompt: 'Generate an image of a car in the rain.',
      }),
    ).toEqual(['imageGeneration']);
  });

  it('can use meaningful description terms when the server name is generic', () => {
    const servers: MCPServersListResponse = {
      companyFiles: createServer({ description: 'Search SharePoint files and documents' }),
    };

    expect(
      getAutoSelectedMCPServerNames({
        servers,
        prompt: 'Search SharePoint for the policy document',
      }),
    ).toEqual(['companyFiles']);
  });

  it('keeps already selected and hidden servers out of auto-selection results', () => {
    const servers: MCPServersListResponse = {
      jira: createServer({ title: 'Jira' }),
      notion: createServer({ title: 'Notion', consumeOnly: true }),
      confluence: createServer({ title: 'Confluence', chatMenu: false }),
    };

    expect(
      getAutoSelectedMCPServerNames({
        servers,
        selectedServers: ['jira'],
        prompt: 'Search Jira, Notion, and Confluence',
      }),
    ).toEqual([]);
  });
});
