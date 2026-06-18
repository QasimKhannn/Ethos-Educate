const { logger } = require('@librechat/data-schemas');
const { createContentAggregator } = require('@librechat/agents');
const {
  initializeAgent,
  validateAgentModel,
  createEdgeCollector,
  filterOrphanedEdges,
  GenerationJobManager,
  getCustomEndpointConfig,
  createSequentialChainEdges,
  // cowork — skills injection (load individual skills by id + build prompt block)
  loadBuiltinSkill,
  buildSkillsPrompt,
  CoworkWorkspaceService,
} = require('@librechat/api');
const {
  EModelEndpoint,
  isAgentsEndpoint,
  getResponseSender,
  isEphemeralAgentId,
} = require('librechat-data-provider');
const {
  createToolEndCallback,
  getDefaultHandlers,
} = require('~/server/controllers/agents/callbacks');
const { loadAgentTools, loadToolsForExecution } = require('~/server/services/ToolService');
const { getModelsConfig } = require('~/server/controllers/ModelController');
const AgentClient = require('~/server/controllers/agents/client');
const { getConvoFiles } = require('~/models/Conversation');
const { processAddedConvo } = require('./addedConvo');
const { getAgent } = require('~/models/Agent');
const { getUserCoworkProject } = require('~/models/CoworkProject'); // cowork
const { logViolation } = require('~/cache');
const db = require('~/models');
const paths = require('~/config/paths'); // cowork — skills root
const _coworkSkillsRoot = process.env.COWORK_SKILLS_ROOT || paths.coworkSkillsRoot; // cowork
const _coworkWorkspaceRoot = process.env.COWORK_WORKSPACE_ROOT || paths.coworkWorkspaces; // cowork
const _coworkMemoryTokenBudget = parseInt(process.env.COWORK_MEMORY_TOKEN_BUDGET || '', 10); // cowork
const _coworkMemoryCharBudget =
  Number.isFinite(_coworkMemoryTokenBudget) && _coworkMemoryTokenBudget > 0
    ? _coworkMemoryTokenBudget * 4
    : undefined; // cowork

/**
 * Creates a tool loader function for the agent.
 * @param {AbortSignal} signal - The abort signal
 * @param {string | null} [streamId] - The stream ID for resumable mode
 * @param {boolean} [definitionsOnly=false] - When true, returns only serializable
 *   tool definitions without creating full tool instances (for event-driven mode)
 */
function createToolLoader(signal, streamId = null, definitionsOnly = false) {
  /**
   * @param {object} params
   * @param {ServerRequest} params.req
   * @param {ServerResponse} params.res
   * @param {string} params.agentId
   * @param {string[]} params.tools
   * @param {string} params.provider
   * @param {string} params.model
   * @param {AgentToolResources} params.tool_resources
   * @returns {Promise<{
   *   tools?: StructuredTool[],
   *   toolContextMap: Record<string, unknown>,
   *   toolDefinitions?: import('@librechat/agents').LCTool[],
   *   userMCPAuthMap?: Record<string, Record<string, string>>,
   *   toolRegistry?: import('@librechat/agents').LCToolRegistry
   * } | undefined>}
   */
  return async function loadTools({
    req,
    res,
    tools,
    model,
    agentId,
    provider,
    tool_options,
    tool_resources,
  }) {
    const agent = { id: agentId, tools, provider, model, tool_options };
    try {
      return await loadAgentTools({
        req,
        res,
        agent,
        signal,
        streamId,
        tool_resources,
        definitionsOnly,
      });
    } catch (error) {
      logger.error('Error loading tools for agent ' + agentId, error);
    }
  };
}

const initializeClient = async ({ req, res, signal, endpointOption }) => {
  if (!endpointOption) {
    throw new Error('Endpoint option not provided');
  }
  const appConfig = req.config;

  /** @type {string | null} */
  const streamId = req._resumableStreamId || null;

  /** @type {Array<UsageMetadata>} */
  const collectedUsage = [];
  /** @type {ArtifactPromises} */
  const artifactPromises = [];
  const { contentParts, aggregateContent } = createContentAggregator();
  const toolEndCallback = createToolEndCallback({ req, res, artifactPromises, streamId });

  /**
   * Agent context store - populated after initialization, accessed by callback via closure.
   * Maps agentId -> { userMCPAuthMap, agent, tool_resources, toolRegistry, openAIApiKey }
   * @type {Map<string, {
   *   userMCPAuthMap?: Record<string, Record<string, string>>,
   *   agent?: object,
   *   tool_resources?: object,
   *   toolRegistry?: import('@librechat/agents').LCToolRegistry,
   *   openAIApiKey?: string
   * }>}
   */
  const agentToolContexts = new Map();

  const toolExecuteOptions = {
    loadTools: async (toolNames, agentId) => {
      const ctx = agentToolContexts.get(agentId) ?? {};
      logger.debug(`[ON_TOOL_EXECUTE] ctx found: ${!!ctx.userMCPAuthMap}, agent: ${ctx.agent?.id}`);
      logger.debug(`[ON_TOOL_EXECUTE] toolRegistry size: ${ctx.toolRegistry?.size ?? 'undefined'}`);

      const result = await loadToolsForExecution({
        req,
        res,
        signal,
        streamId,
        toolNames,
        agent: ctx.agent,
        toolRegistry: ctx.toolRegistry,
        userMCPAuthMap: ctx.userMCPAuthMap,
        tool_resources: ctx.tool_resources,
      });

      logger.debug(`[ON_TOOL_EXECUTE] loaded ${result.loadedTools?.length ?? 0} tools`);
      return result;
    },
    toolEndCallback,
  };

  const eventHandlers = getDefaultHandlers({
    res,
    toolExecuteOptions,
    aggregateContent,
    toolEndCallback,
    collectedUsage,
    streamId,
  });

  if (!endpointOption.agent) {
    throw new Error('No agent promise provided');
  }

  const primaryAgent = await endpointOption.agent;
  delete endpointOption.agent;
  if (!primaryAgent) {
    throw new Error('Agent not found');
  }

  // cowork — inject enabled skills into the agent's system prompt.
  // ONLY fires when the client sends coworkProjectId (Cowork conversations).
  // Normal chats, projects, and the global tool registry are completely unaffected.
  // Fails safe: any error here logs a warning and leaves instructions unchanged.
  try {
    const coworkProjectId = req.body?.coworkProjectId;
    if (coworkProjectId) {
      const project = await getUserCoworkProject({ user: req.user?.id, projectId: coworkProjectId });
      const enabledIds = Array.isArray(project?.enabledSkills) ? project.enabledSkills : [];
      if (enabledIds.length > 0) {
        const loadedSkills = (
          await Promise.all(enabledIds.map((id) => loadBuiltinSkill(_coworkSkillsRoot, id)))
        ).filter(Boolean);
        const skillsBlock = buildSkillsPrompt(loadedSkills);
        if (skillsBlock) {
          primaryAgent.instructions = [primaryAgent.instructions ?? '', skillsBlock]
            .filter(Boolean)
            .join('\n\n');
        }
      }

      // cowork — inject project memory (core, budget-capped) into the system prompt so it
      // is always honored and OUTRANKS the global per-user memory. Read-only here.
      if (project) {
        try {
          const ws = new CoworkWorkspaceService({
            root: _coworkWorkspaceRoot,
            projectId: String(project._id),
            memoryCharBudget: _coworkMemoryCharBudget,
          });
          const projectMemory = await ws.getInjectableMemory();
          if (projectMemory && projectMemory.trim()) {
            const memoryBlock =
              '# Project memory (STANDING INSTRUCTIONS)\n' +
              'Durable, user-approved facts and preferences for THIS project. Apply them ' +
              'proactively from your first response, and prioritise them over any general or ' +
              "global preferences. Only a directly conflicting instruction in the user's latest " +
              'message overrides them.\n\n' +
              projectMemory;
            primaryAgent.instructions = [primaryAgent.instructions ?? '', memoryBlock]
              .filter(Boolean)
              .join('\n\n');
          }
        } catch (memErr) {
          logger.warn('[initializeClient] cowork project memory injection failed', memErr);
        }
      }
    }
  } catch (coworkErr) {
    logger.warn('[initializeClient] cowork skills injection failed; continuing without skills', coworkErr);
  }

  // cowork — modes (Ask / Plan / Agent). Per-message; default Agent. Steers the agent via its
  // system prompt, and in Ask mode hard-removes execute_code so it cannot touch files. coworkMode
  // is only sent by the Cowork chat, so normal chats and other agents are unaffected.
  try {
    const coworkMode = req.body?.coworkMode;
    if (coworkMode === 'ask' || coworkMode === 'plan') {
      // The workspace is enforced read-only for these modes at the execution layer
      // (see api/app/clients/tools/util/handleTools.js) — the prompt below is only for
      // behavior/tone; it is NOT what prevents writes.
      const modeBlock =
        coworkMode === 'ask'
          ? '# Mode: ASK\nYou are in ASK mode. Answer the question directly and conversationally. You can read the workspace to inform your answer, but the workspace is read-only in this mode — you cannot create, edit, or delete files. If the task needs file changes, say so briefly and suggest switching to Agent mode.'
          : '# Mode: PLAN\nYou are in PLAN mode. Read the workspace as needed to ground the plan (read-only — you cannot create, edit, or delete files). Respond with ONLY an implementation plan, grounded in the actual workspace, using EXACTLY this markdown structure and nothing else:\n\n## Goal\n<one or two sentences>\n\n## Approach\n<numbered, concrete steps>\n\n## Files\n<bullets of files you would create or change, each with a short note; write "None" if not applicable>\n\n## Risks & decisions\n<bullets; write "None" if not applicable>\n\n## Next step\nApprove this plan to run it in Agent mode.';
      primaryAgent.instructions = [primaryAgent.instructions ?? '', modeBlock]
        .filter(Boolean)
        .join('\n\n');
    }
  } catch (modeErr) {
    logger.warn('[initializeClient] cowork mode handling failed; continuing in default mode', modeErr);
  }

  const modelsConfig = await getModelsConfig(req);
  const validationResult = await validateAgentModel({
    req,
    res,
    modelsConfig,
    logViolation,
    agent: primaryAgent,
  });

  if (!validationResult.isValid) {
    throw new Error(validationResult.error?.message);
  }

  const agentConfigs = new Map();
  const allowedProviders = new Set(appConfig?.endpoints?.[EModelEndpoint.agents]?.allowedProviders);

  /** Event-driven mode: only load tool definitions, not full instances */
  const loadTools = createToolLoader(signal, streamId, true);
  /** @type {Array<MongoFile>} */
  const requestFiles = req.body.files ?? [];
  /** @type {string} */
  const conversationId = req.body.conversationId;
  /** @type {string | undefined} */
  const parentMessageId = req.body.parentMessageId;

  const primaryConfig = await initializeAgent(
    {
      req,
      res,
      loadTools,
      requestFiles,
      conversationId,
      parentMessageId,
      agent: primaryAgent,
      endpointOption,
      allowedProviders,
      isInitialAgent: true,
    },
    {
      getConvoFiles,
      getFiles: db.getFiles,
      getUserKey: db.getUserKey,
      getMessages: db.getMessages,
      updateFilesUsage: db.updateFilesUsage,
      getUserKeyValues: db.getUserKeyValues,
      getUserCodeFiles: db.getUserCodeFiles,
      getToolFilesByIds: db.getToolFilesByIds,
      getCodeGeneratedFiles: db.getCodeGeneratedFiles,
    },
  );

  logger.debug(
    `[initializeClient] Storing tool context for ${primaryConfig.id}: ${primaryConfig.toolDefinitions?.length ?? 0} tools, registry size: ${primaryConfig.toolRegistry?.size ?? '0'}`,
  );
  agentToolContexts.set(primaryConfig.id, {
    agent: primaryAgent,
    toolRegistry: primaryConfig.toolRegistry,
    userMCPAuthMap: primaryConfig.userMCPAuthMap,
    tool_resources: primaryConfig.tool_resources,
  });

  const agent_ids = primaryConfig.agent_ids;
  let userMCPAuthMap = primaryConfig.userMCPAuthMap;

  /** @type {Set<string>} Track agents that failed to load (orphaned references) */
  const skippedAgentIds = new Set();

  async function processAgent(agentId) {
    const agent = await getAgent({ id: agentId });
    if (!agent) {
      logger.warn(
        `[processAgent] Handoff agent ${agentId} not found, skipping (orphaned reference)`,
      );
      skippedAgentIds.add(agentId);
      return null;
    }

    const validationResult = await validateAgentModel({
      req,
      res,
      agent,
      modelsConfig,
      logViolation,
    });

    if (!validationResult.isValid) {
      throw new Error(validationResult.error?.message);
    }

    const config = await initializeAgent(
      {
        req,
        res,
        agent,
        loadTools,
        requestFiles,
        conversationId,
        parentMessageId,
        endpointOption,
        allowedProviders,
      },
      {
        getConvoFiles,
        getFiles: db.getFiles,
        getUserKey: db.getUserKey,
        getMessages: db.getMessages,
        updateFilesUsage: db.updateFilesUsage,
        getUserKeyValues: db.getUserKeyValues,
        getUserCodeFiles: db.getUserCodeFiles,
        getToolFilesByIds: db.getToolFilesByIds,
        getCodeGeneratedFiles: db.getCodeGeneratedFiles,
      },
    );

    if (userMCPAuthMap != null) {
      Object.assign(userMCPAuthMap, config.userMCPAuthMap ?? {});
    } else {
      userMCPAuthMap = config.userMCPAuthMap;
    }

    /** Store handoff agent's tool context for ON_TOOL_EXECUTE callback */
    agentToolContexts.set(agentId, {
      agent,
      toolRegistry: config.toolRegistry,
      userMCPAuthMap: config.userMCPAuthMap,
      tool_resources: config.tool_resources,
    });

    agentConfigs.set(agentId, config);
    return agent;
  }

  const checkAgentInit = (agentId) => agentId === primaryConfig.id || agentConfigs.has(agentId);

  // Graph topology discovery for recursive agent handoffs (BFS)
  const { edgeMap, agentsToProcess, collectEdges } = createEdgeCollector(
    checkAgentInit,
    skippedAgentIds,
  );

  // Seed with primary agent's edges
  collectEdges(primaryConfig.edges);

  // BFS to load and merge all connected agents (enables transitive handoffs: A->B->C)
  while (agentsToProcess.size > 0) {
    const agentId = agentsToProcess.values().next().value;
    agentsToProcess.delete(agentId);
    try {
      const agent = await processAgent(agentId);
      if (agent?.edges?.length) {
        collectEdges(agent.edges);
      }
    } catch (err) {
      logger.error(`[initializeClient] Error processing agent ${agentId}:`, err);
      skippedAgentIds.add(agentId);
    }
  }

  /** @deprecated Agent Chain */
  if (agent_ids?.length) {
    for (const agentId of agent_ids) {
      if (checkAgentInit(agentId)) {
        continue;
      }
      try {
        await processAgent(agentId);
      } catch (err) {
        logger.error(`[initializeClient] Error processing chain agent ${agentId}:`, err);
        skippedAgentIds.add(agentId);
      }
    }
    const chain = await createSequentialChainEdges([primaryConfig.id].concat(agent_ids), '{convo}');
    collectEdges(chain);
  }

  let edges = Array.from(edgeMap.values());

  /** Multi-Convo: Process addedConvo for parallel agent execution */
  const { userMCPAuthMap: updatedMCPAuthMap } = await processAddedConvo({
    req,
    res,
    loadTools,
    logViolation,
    modelsConfig,
    requestFiles,
    agentConfigs,
    primaryAgent,
    endpointOption,
    userMCPAuthMap,
    conversationId,
    parentMessageId,
    allowedProviders,
    primaryAgentId: primaryConfig.id,
  });

  if (updatedMCPAuthMap) {
    userMCPAuthMap = updatedMCPAuthMap;
  }

  // Ensure edges is an array when we have multiple agents (multi-agent mode)
  // MultiAgentGraph.categorizeEdges requires edges to be iterable
  if (agentConfigs.size > 0 && !edges) {
    edges = [];
  }

  // Filter out edges referencing non-existent agents (orphaned references)
  edges = filterOrphanedEdges(edges, skippedAgentIds);

  primaryConfig.edges = edges;

  let endpointConfig = appConfig.endpoints?.[primaryConfig.endpoint];
  if (!isAgentsEndpoint(primaryConfig.endpoint) && !endpointConfig) {
    try {
      endpointConfig = getCustomEndpointConfig({
        endpoint: primaryConfig.endpoint,
        appConfig,
      });
    } catch (err) {
      logger.error(
        '[api/server/controllers/agents/client.js #titleConvo] Error getting custom endpoint config',
        err,
      );
    }
  }

  const sender =
    primaryAgent.name ??
    getResponseSender({
      ...endpointOption,
      model: endpointOption.model_parameters.model,
      modelDisplayLabel: endpointConfig?.modelDisplayLabel,
      modelLabel: endpointOption.model_parameters.modelLabel,
    });

  const client = new AgentClient({
    req,
    res,
    sender,
    contentParts,
    agentConfigs,
    eventHandlers,
    collectedUsage,
    aggregateContent,
    artifactPromises,
    agent: primaryConfig,
    spec: endpointOption.spec,
    iconURL: endpointOption.iconURL,
    attachments: primaryConfig.attachments,
    endpointType: endpointOption.endpointType,
    resendFiles: primaryConfig.resendFiles ?? true,
    maxContextTokens: primaryConfig.maxContextTokens,
    endpoint: isEphemeralAgentId(primaryConfig.id) ? primaryConfig.endpoint : EModelEndpoint.agents,
  });

  if (streamId) {
    GenerationJobManager.setCollectedUsage(streamId, collectedUsage);
  }

  return { client, userMCPAuthMap };
};

module.exports = { initializeClient };
