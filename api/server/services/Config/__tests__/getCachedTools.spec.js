const { CacheKeys, Constants } = require('librechat-data-provider');

jest.mock('~/cache/getLogStores');
const getLogStores = require('~/cache/getLogStores');

const mockCache = { get: jest.fn(), set: jest.fn(), delete: jest.fn() };
getLogStores.mockReturnValue(mockCache);

const {
  ToolCacheKeys,
  getCachedTools,
  setCachedTools,
  getMCPServerTools,
  invalidateCachedTools,
  invalidateMCPServerTools,
} = require('../getCachedTools');

describe('getCachedTools', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getLogStores.mockReturnValue(mockCache);
  });

  describe('ToolCacheKeys.MCP_SERVER', () => {
    it('should generate cache keys that include userId', () => {
      const key = ToolCacheKeys.MCP_SERVER('user123', 'github');
      expect(key).toBe('tools:mcp:user123:github:0');
    });
  });

  describe('TOOL_CACHE namespace usage', () => {
    it('getCachedTools should use TOOL_CACHE namespace', async () => {
      mockCache.get.mockResolvedValue(null);
      await getCachedTools();
      expect(getLogStores).toHaveBeenCalledWith(CacheKeys.TOOL_CACHE);
    });

    it('getCachedTools with MCP server options should use TOOL_CACHE namespace', async () => {
      mockCache.get.mockResolvedValueOnce(null).mockResolvedValueOnce({ tool1: {} });
      await getCachedTools({ userId: 'user1', serverName: 'github' });
      expect(getLogStores).toHaveBeenCalledWith(CacheKeys.TOOL_CACHE);
      expect(mockCache.get).toHaveBeenCalledWith(ToolCacheKeys.MCP_SERVER('user1', 'github'));
    });

    it('setCachedTools should use TOOL_CACHE namespace', async () => {
      mockCache.set.mockResolvedValue(true);
      const tools = { tool1: { type: 'function' } };
      await setCachedTools(tools);
      expect(getLogStores).toHaveBeenCalledWith(CacheKeys.TOOL_CACHE);
      expect(mockCache.set).toHaveBeenCalledWith(ToolCacheKeys.GLOBAL, tools, expect.any(Number));
    });

    it('setCachedTools with MCP server options should use TOOL_CACHE namespace', async () => {
      mockCache.get.mockResolvedValueOnce(null);
      mockCache.set.mockResolvedValue(true);
      const tools = { tool1: { type: 'function' } };
      await setCachedTools(tools, { userId: 'user1', serverName: 'github' });
      expect(getLogStores).toHaveBeenCalledWith(CacheKeys.TOOL_CACHE);
      expect(mockCache.set).toHaveBeenCalledWith(
        ToolCacheKeys.MCP_SERVER('user1', 'github'),
        tools,
        expect.any(Number),
      );
    });

    it('invalidateCachedTools should use TOOL_CACHE namespace', async () => {
      mockCache.delete.mockResolvedValue(true);
      await invalidateCachedTools({ invalidateGlobal: true });
      expect(getLogStores).toHaveBeenCalledWith(CacheKeys.TOOL_CACHE);
      expect(mockCache.delete).toHaveBeenCalledWith(ToolCacheKeys.GLOBAL);
    });

    it('getMCPServerTools should use TOOL_CACHE namespace', async () => {
      mockCache.get.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      await getMCPServerTools('user1', 'github');
      expect(getLogStores).toHaveBeenCalledWith(CacheKeys.TOOL_CACHE);
      expect(mockCache.get).toHaveBeenCalledWith(ToolCacheKeys.MCP_SERVER('user1', 'github'));
    });

    it('prefers shared app-level tools over a user-specific cache', async () => {
      const sharedToolName = `create_document${Constants.mcp_delimiter}files`;
      const userToolName = `other_tool${Constants.mcp_delimiter}other`;
      const sharedTools = { [sharedToolName]: { type: 'function' } };

      mockCache.get.mockResolvedValueOnce({ ...sharedTools, [userToolName]: { type: 'function' } });

      await expect(getMCPServerTools('user1', 'files')).resolves.toEqual(sharedTools);
      expect(mockCache.get).toHaveBeenCalledWith(ToolCacheKeys.GLOBAL);
    });

    it('invalidates all user-specific tool caches for a refreshed MCP server', async () => {
      mockCache.set.mockResolvedValue(true);
      await invalidateMCPServerTools('github');
      expect(mockCache.set).toHaveBeenCalledWith(
        ToolCacheKeys.MCP_SERVER_REVISION('github'),
        expect.any(String),
      );
    });

    it('should NOT use CONFIG_STORE namespace', async () => {
      mockCache.get.mockResolvedValue(null);
      await getCachedTools();
      await getMCPServerTools('user1', 'github');
      mockCache.set.mockResolvedValue(true);
      await setCachedTools({ tool1: {} });
      mockCache.delete.mockResolvedValue(true);
      await invalidateCachedTools({ invalidateGlobal: true });

      const allCalls = getLogStores.mock.calls.flat();
      expect(allCalls).not.toContain(CacheKeys.CONFIG_STORE);
      expect(allCalls.every((key) => key === CacheKeys.TOOL_CACHE)).toBe(true);
    });
  });
});
