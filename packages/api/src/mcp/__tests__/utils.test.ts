import {
  canonicalizeMCPServerName,
  isMCPServerName,
  isMCPToolFromServer,
  normalizeKnownMCPServerNames,
  normalizeKnownMCPToolId,
  normalizeKnownMCPToolIds,
  normalizeKnownMCPToolOptions,
  normalizeServerName,
  resolveKnownMCPServerName,
} from '../utils';

describe('canonical MCP server identification', () => {
  it('canonicalizes casing and display-name separators', () => {
    expect(canonicalizeMCPServerName(' Image_Generation ')).toBe('imagegeneration');
    expect(canonicalizeMCPServerName('Image-generation')).toBe('imagegeneration');
  });

  it('matches equivalent server display names without matching other servers', () => {
    expect(isMCPServerName('downloadable_files_creation', 'Downloadable-Files-Creation')).toBe(
      true,
    );
    expect(isMCPServerName('Image-generation', 'Image_Generation')).toBe(true);
    expect(isMCPServerName('Image Analysis', 'Image_Generation')).toBe(false);
  });

  it('matches the MCP server suffix without depending on its display-name format', () => {
    expect(isMCPToolFromServer('generate_images_mcp_Image-generation', 'Image_Generation')).toBe(
      true,
    );
    expect(
      isMCPToolFromServer(
        'create_teacher_worksheet_mcp_downloadable_files_creation',
        'Image_Generation',
      ),
    ).toBe(false);
    expect(isMCPToolFromServer('generate_images', 'Image_Generation')).toBe(false);
  });

  it('resolves Websearch aliases to the configured lowercase identifier', () => {
    expect(resolveKnownMCPServerName('Websearch')).toBe('websearch');
    expect(resolveKnownMCPServerName('Web Search')).toBe('websearch');
    expect(resolveKnownMCPServerName('Downloadable-Files-Creation')).toBe(
      'Downloadable-Files-Creation',
    );
  });

  it('normalizes only the server suffix in MCP tool identifiers', () => {
    expect(normalizeKnownMCPToolId('search_mcp_Websearch')).toBe('search_mcp_websearch');
    expect(normalizeKnownMCPToolId('ordinary_tool')).toBe('ordinary_tool');
    expect(normalizeKnownMCPToolId('generate_images_mcp_Image_Generation')).toBe(
      'generate_images_mcp_Image_Generation',
    );
  });

  it('normalizes and de-duplicates persisted Websearch references', () => {
    expect(
      normalizeKnownMCPToolIds([
        'search_mcp_Websearch',
        'search_mcp_websearch',
        'other_mcp_Websearch',
      ]),
    ).toEqual(['search_mcp_websearch', 'other_mcp_websearch']);
    expect(normalizeKnownMCPServerNames(['Websearch', 'websearch', 'other-server'])).toEqual([
      'websearch',
      'other-server',
    ]);
  });

  it('preserves unrelated duplicates and malformed legacy placeholders', () => {
    expect(normalizeKnownMCPToolIds(['ordinary_tool', 'ordinary_tool', null, undefined])).toEqual([
      'ordinary_tool',
      'ordinary_tool',
      null,
      undefined,
    ]);
  });

  it('keeps canonical tool options when a legacy key collides', () => {
    expect(
      normalizeKnownMCPToolOptions({
        search_mcp_Websearch: { source: 'legacy' },
        search_mcp_websearch: { source: 'canonical' },
      }),
    ).toEqual({ search_mcp_websearch: { source: 'canonical' } });
  });
});

describe('normalizeServerName', () => {
  it('should not modify server names that already match the pattern', () => {
    const result = normalizeServerName('valid-server_name.123');
    expect(result).toBe('valid-server_name.123');
  });

  it('should normalize server names with non-ASCII characters', () => {
    const result = normalizeServerName('我的服务');
    // Should generate a fallback name with a hash
    expect(result).toMatch(/^server_\d+$/);
    expect(result).toMatch(/^[a-zA-Z0-9_.-]+$/);
  });

  it('should normalize server names with special characters', () => {
    const result = normalizeServerName('server@name!');
    // The actual result doesn't have the trailing underscore after trimming
    expect(result).toBe('server_name');
    expect(result).toMatch(/^[a-zA-Z0-9_.-]+$/);
  });

  it('should trim leading and trailing underscores', () => {
    const result = normalizeServerName('!server-name!');
    expect(result).toBe('server-name');
    expect(result).toMatch(/^[a-zA-Z0-9_.-]+$/);
  });
});
