import { Keyv } from 'keyv';
import { logger } from '@librechat/data-schemas';
import type { IServerConfigsRepositoryInterface } from './ServerConfigsRepositoryInterface';
import type * as t from '~/mcp/types';
import { MCPInspectionFailedError, isMCPDomainNotAllowedError } from '~/mcp/errors';
import { ServerConfigsCacheFactory } from './cache/ServerConfigsCacheFactory';
import { MCPServerInspector } from './MCPServerInspector';
import { ServerConfigsDB } from './db/ServerConfigsDB';
import { cacheConfig } from '~/cache/cacheConfig';

/**
 * Central registry for managing MCP server configurations.
 * Authoritative source of truth for all MCP servers provided by Enterprise Chat.
 *
 * Uses a two-repository architecture:
 * - Cache Repository: Stores YAML-defined configs loaded at startup (in-memory or Redis-backed)
 * - DB Repository: Stores dynamic configs created at runtime (not yet implemented)
 *
 * Query priority: Cache configs are checked first, then DB configs.
 */
export class MCPServersRegistry {
  private static instance: MCPServersRegistry;

  private readonly dbConfigsRepo: IServerConfigsRepositoryInterface;
  private readonly cacheConfigsRepo: IServerConfigsRepositoryInterface;
  private readonly allowedDomains?: string[] | null;
  private readonly readThroughCache: Keyv<t.ParsedServerConfig>;
  private readonly readThroughCacheAll: Keyv<Record<string, t.ParsedServerConfig>>;
  private readonly pendingGetAllPromises = new Map<
    string,
    Promise<Record<string, t.ParsedServerConfig>>
  >();

  constructor(mongoose: typeof import('mongoose'), allowedDomains?: string[] | null) {
    this.dbConfigsRepo = new ServerConfigsDB(mongoose);
    this.cacheConfigsRepo = ServerConfigsCacheFactory.create('App', false);
    this.allowedDomains = allowedDomains;

    const ttl = cacheConfig.MCP_REGISTRY_CACHE_TTL;

    this.readThroughCache = new Keyv<t.ParsedServerConfig>({
      namespace: 'mcp-registry-read-through',
      ttl,
    });

    this.readThroughCacheAll = new Keyv<Record<string, t.ParsedServerConfig>>({
      namespace: 'mcp-registry-read-through-all',
      ttl,
    });
  }

  /** Creates and initializes the singleton MCPServersRegistry instance */
  public static createInstance(
    mongoose: typeof import('mongoose'),
    allowedDomains?: string[] | null,
  ): MCPServersRegistry {
    if (!mongoose) {
      throw new Error(
        'MCPServersRegistry creation failed: mongoose instance is required for database operations. ' +
          'Ensure mongoose is initialized before creating the registry.',
      );
    }
    if (MCPServersRegistry.instance) {
      logger.debug('[MCPServersRegistry] Returning existing instance');
      return MCPServersRegistry.instance;
    }
    logger.info('[MCPServersRegistry] Creating new instance');
    MCPServersRegistry.instance = new MCPServersRegistry(mongoose, allowedDomains);
    return MCPServersRegistry.instance;
  }

  /** Returns the singleton MCPServersRegistry instance */
  public static getInstance(): MCPServersRegistry {
    if (!MCPServersRegistry.instance) {
      throw new Error('MCPServersRegistry has not been initialized.');
    }
    return MCPServersRegistry.instance;
  }

  public getAllowedDomains(): string[] | null | undefined {
    return this.allowedDomains;
  }

  /** Returns true when no explicit allowedDomains allowlist is configured, enabling SSRF TOCTOU protection */
  public shouldEnableSSRFProtection(): boolean {
    return !Array.isArray(this.allowedDomains) || this.allowedDomains.length === 0;
  }

  public async getServerConfig(
    serverName: string,
    userId?: string,
  ): Promise<t.ParsedServerConfig | undefined> {
    const cacheKey = this.getReadThroughCacheKey(serverName, userId);

    if (await this.readThroughCache.has(cacheKey)) {
      return await this.readThroughCache.get(cacheKey);
    }

    // First we check if any config exist with the cache
    // Yaml config are pre loaded to the cache
    const configFromCache = await this.cacheConfigsRepo.get(serverName);
    if (configFromCache) {
      await this.readThroughCache.set(cacheKey, configFromCache);
      return configFromCache;
    }

    const configFromDB = await this.dbConfigsRepo.get(serverName, userId);
    await this.readThroughCache.set(cacheKey, configFromDB);
    return configFromDB;
  }

  public async getAllServerConfigs(userId?: string): Promise<Record<string, t.ParsedServerConfig>> {
    const cacheKey = userId ?? '__no_user__';

    if (await this.readThroughCacheAll.has(cacheKey)) {
      return (await this.readThroughCacheAll.get(cacheKey)) ?? {};
    }

    const pending = this.pendingGetAllPromises.get(cacheKey);
    if (pending) {
      return pending;
    }

    const fetchPromise = this.fetchAllServerConfigs(cacheKey, userId);
    this.pendingGetAllPromises.set(cacheKey, fetchPromise);

    try {
      return await fetchPromise;
    } finally {
      this.pendingGetAllPromises.delete(cacheKey);
    }
  }

  private async fetchAllServerConfigs(
    cacheKey: string,
    userId?: string,
  ): Promise<Record<string, t.ParsedServerConfig>> {
    const result = {
      ...(await this.cacheConfigsRepo.getAll()),
      ...(await this.dbConfigsRepo.getAll(userId)),
    };

    await this.readThroughCacheAll.set(cacheKey, result);
    return result;
  }

  /**
   * Stores a minimal config stub so the server remains "known" to the registry
   * even when inspection fails at startup. This enables reinitialize to recover.
   */
  public async addServerStub(
    serverName: string,
    config: t.MCPOptions,
    storageLocation: 'CACHE' | 'DB',
    userId?: string,
  ): Promise<t.AddServerResult> {
    const configRepo = this.getConfigRepository(storageLocation);
    const stubConfig: t.ParsedServerConfig = { ...config, inspectionFailed: true };
    const result = await configRepo.add(serverName, stubConfig, userId);
    await this.invalidateReadThroughCaches(serverName, userId);
    return result;
  }

  /** Keeps a configured server discoverable before its network inspection completes. */
  public async ensureServerStub(
    serverName: string,
    config: t.MCPOptions,
    storageLocation: 'CACHE' | 'DB',
    userId?: string,
  ): Promise<t.AddServerResult> {
    const configRepo = this.getConfigRepository(storageLocation);
    const existingConfig = await configRepo.get(serverName, userId);
    if (existingConfig) {
      return { serverName, config: existingConfig };
    }

    return await this.addServerStub(serverName, config, storageLocation, userId);
  }

  /** Replaces an existing server with a recoverable stub without removing it from the catalog. */
  public async upsertServerStub(
    serverName: string,
    config: t.MCPOptions,
    storageLocation: 'CACHE' | 'DB',
    userId?: string,
  ): Promise<t.AddServerResult> {
    const configRepo = this.getConfigRepository(storageLocation);
    const existingConfig = await configRepo.get(serverName, userId);
    if (!existingConfig) {
      return await this.addServerStub(serverName, config, storageLocation, userId);
    }

    const stubConfig: t.ParsedServerConfig = {
      ...config,
      inspectionFailed: true,
      updatedAt: Date.now(),
    };
    await configRepo.update(serverName, stubConfig, userId);
    await this.invalidateReadThroughCaches(serverName, userId);
    return { serverName, config: stubConfig };
  }

  public async addServer(
    serverName: string,
    config: t.MCPOptions,
    storageLocation: 'CACHE' | 'DB',
    userId?: string,
  ): Promise<t.AddServerResult> {
    const configRepo = this.getConfigRepository(storageLocation);
    let parsedConfig: t.ParsedServerConfig;
    try {
      parsedConfig = await MCPServerInspector.inspect(
        serverName,
        config,
        undefined,
        this.allowedDomains,
      );
    } catch (error) {
      logger.error(`[MCPServersRegistry] Failed to inspect server "${serverName}":`, error);
      // Preserve domain-specific error for better error handling
      if (isMCPDomainNotAllowedError(error)) {
        throw error;
      }
      throw new MCPInspectionFailedError(serverName, error as Error);
    }
    const result = await configRepo.add(serverName, parsedConfig, userId);
    await this.invalidateReadThroughCaches(serverName, userId);
    return result;
  }

  /** Inspects and stores a server without creating a gap when the config already exists. */
  public async upsertServer(
    serverName: string,
    config: t.MCPOptions,
    storageLocation: 'CACHE' | 'DB',
    userId?: string,
  ): Promise<t.AddServerResult> {
    const configRepo = this.getConfigRepository(storageLocation);
    const existingConfig = await configRepo.get(serverName, userId);
    if (!existingConfig) {
      return await this.addServer(serverName, config, storageLocation, userId);
    }

    const updatedConfig = await this.updateServer(serverName, config, storageLocation, userId);
    return { serverName, config: updatedConfig };
  }

  /**
   * Re-inspects a server that previously failed initialization.
   * Uses the stored stub config to attempt a full inspection and replaces the stub on success.
   */
  public async reinspectServer(
    serverName: string,
    storageLocation: 'CACHE' | 'DB',
    userId?: string,
  ): Promise<t.AddServerResult> {
    const configRepo = this.getConfigRepository(storageLocation);
    const existing = await configRepo.get(serverName, userId);
    if (!existing) {
      throw new Error(`Server "${serverName}" not found in ${storageLocation} for reinspection.`);
    }
    if (!existing.inspectionFailed) {
      throw new Error(
        `Server "${serverName}" is not in a failed state. Use updateServer() instead.`,
      );
    }

    const { inspectionFailed: _, ...configForInspection } = existing;
    let parsedConfig: t.ParsedServerConfig;
    try {
      parsedConfig = await MCPServerInspector.inspect(
        serverName,
        configForInspection,
        undefined,
        this.allowedDomains,
      );
    } catch (error) {
      logger.error(`[MCPServersRegistry] Reinspection failed for server "${serverName}":`, error);
      if (isMCPDomainNotAllowedError(error)) {
        throw error;
      }
      throw new MCPInspectionFailedError(serverName, error as Error);
    }

    const updatedConfig = { ...parsedConfig, updatedAt: Date.now() };
    await configRepo.update(serverName, updatedConfig, userId);
    await this.invalidateReadThroughCaches(serverName, userId);
    return { serverName, config: updatedConfig };
  }

  public async updateServer(
    serverName: string,
    config: t.MCPOptions,
    storageLocation: 'CACHE' | 'DB',
    userId?: string,
  ): Promise<t.ParsedServerConfig> {
    const configRepo = this.getConfigRepository(storageLocation);

    // Merge existing admin API key if not provided in update (needed for inspection)
    let configForInspection = { ...config };
    if (config.apiKey?.source === 'admin' && !config.apiKey?.key) {
      const existingConfig = await configRepo.get(serverName, userId);
      if (existingConfig?.apiKey?.key) {
        configForInspection = {
          ...configForInspection,
          apiKey: {
            ...configForInspection.apiKey!,
            key: existingConfig.apiKey.key,
          },
        };
      }
    }

    let parsedConfig: t.ParsedServerConfig;
    try {
      parsedConfig = await MCPServerInspector.inspect(
        serverName,
        configForInspection,
        undefined,
        this.allowedDomains,
      );
    } catch (error) {
      logger.error(`[MCPServersRegistry] Failed to inspect server "${serverName}":`, error);
      // Preserve domain-specific error for better error handling
      if (isMCPDomainNotAllowedError(error)) {
        throw error;
      }
      throw new MCPInspectionFailedError(serverName, error as Error);
    }
    const updatedConfig = { ...parsedConfig, updatedAt: Date.now() };
    await configRepo.update(serverName, updatedConfig, userId);
    await this.invalidateReadThroughCaches(serverName, userId);
    return updatedConfig;
  }

  /** Removes cached YAML servers that are no longer present in the active application config. */
  public async removeStaleCacheServers(activeServerNames: ReadonlySet<string>): Promise<void> {
    const existingConfigs = await this.cacheConfigsRepo.getAll();
    const staleServerNames = Object.keys(existingConfigs).filter(
      (serverName) => !activeServerNames.has(serverName),
    );
    if (staleServerNames.length === 0) return;

    await Promise.all(
      staleServerNames.map((serverName) => this.cacheConfigsRepo.remove(serverName)),
    );
    await this.readThroughCache.clear();
    await this.readThroughCacheAll.clear();
  }

  // TODO: This is currently used to determine if a server requires OAuth. However, this info can
  // can be determined through config.requiresOAuth. Refactor usages and remove this method.
  public async getOAuthServers(userId?: string): Promise<Set<string>> {
    const allServers = await this.getAllServerConfigs(userId);
    const oauthServers = Object.entries(allServers).filter(([, config]) => config.requiresOAuth);
    return new Set(oauthServers.map(([name]) => name));
  }

  public async reset(): Promise<void> {
    await this.cacheConfigsRepo.reset();
    await this.readThroughCache.clear();
    await this.readThroughCacheAll.clear();
  }

  public async removeServer(
    serverName: string,
    storageLocation: 'CACHE' | 'DB',
    userId?: string,
  ): Promise<void> {
    const configRepo = this.getConfigRepository(storageLocation);
    await configRepo.remove(serverName, userId);
    await this.invalidateReadThroughCaches(serverName, userId);
  }

  private getConfigRepository(storageLocation: 'CACHE' | 'DB'): IServerConfigsRepositoryInterface {
    switch (storageLocation) {
      case 'CACHE':
        return this.cacheConfigsRepo;
      case 'DB':
        return this.dbConfigsRepo;
      default:
        throw new Error(
          `MCPServersRegistry: The provided storage location "${storageLocation}" is not supported`,
        );
    }
  }

  private getReadThroughCacheKey(serverName: string, userId?: string): string {
    return userId ? `${serverName}::${userId}` : serverName;
  }

  private async invalidateReadThroughCaches(serverName: string, userId?: string): Promise<void> {
    await this.readThroughCache.delete(this.getReadThroughCacheKey(serverName, userId));
    await this.readThroughCache.delete(this.getReadThroughCacheKey(serverName));
    await this.readThroughCacheAll.clear();
  }
}
