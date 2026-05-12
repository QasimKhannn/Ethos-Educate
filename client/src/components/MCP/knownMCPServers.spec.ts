import {
  getKnownMCPServerDisplayName,
  getKnownMCPServerIconPath,
  getKnownMCPServerPresentation,
} from './knownMCPServers';

describe('knownMCPServers', () => {
  it('resolves display names for extended connector coverage', () => {
    expect(getKnownMCPServerDisplayName('outlook-email')).toBe('Outlook Email');
    expect(getKnownMCPServerDisplayName('google-calendar')).toBe('Google Calendar');
    expect(getKnownMCPServerDisplayName('github')).toBe('GitHub');
    expect(getKnownMCPServerDisplayName('websearch')).toBe('Web Search');
  });

  it('resolves icon paths for prefixed and suffixed MCP server names', () => {
    expect(getKnownMCPServerIconPath('mcp-google-drive')).toBe('/assets/mcp/google-drive.svg');
    expect(getKnownMCPServerIconPath('github-mcp-server')).toBe('/assets/mcp/github.svg');
    expect(getKnownMCPServerIconPath('lesson-planning')).toBe('/assets/mcp/downloadfiles.svg');
    expect(getKnownMCPServerIconPath('downloadable-files-creation')).toBe(
      '/assets/mcp/downloadfiles.svg',
    );
    expect(getKnownMCPServerIconPath('websearch')).toBe('/assets/mcp/websearch.svg');
  });

  it('returns undefined for unknown custom servers', () => {
    expect(getKnownMCPServerPresentation('custom-internal-mcp')).toBeUndefined();
  });
});
