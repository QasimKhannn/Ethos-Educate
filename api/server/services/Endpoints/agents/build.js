const { logger } = require('@librechat/data-schemas');
const {
  Constants,
  EToolResources,
  isAgentsEndpoint,
  removeNullishValues,
} = require('librechat-data-provider');
const { loadAgent } = require('~/models/Agent');
const { getUserProject } = require('~/models/Project');

const mergeProjectContext = async ({ req, agent }) => {
  const projectId = req.body?.projectId;
  if (!agent || !projectId || !req.user?.id) {
    return agent;
  }

  const project = await getUserProject({ user: req.user.id, projectId });
  const fileIds = project?.fileIds ?? [];
  if (!fileIds.length) {
    return agent;
  }

  const toolResources = agent.tool_resources ?? {};
  const context = toolResources[EToolResources.context] ?? {};
  const contextFileIds = Array.from(new Set([...(context.file_ids ?? []), ...fileIds]));

  return {
    ...agent,
    tool_resources: {
      ...toolResources,
      [EToolResources.context]: {
        ...context,
        file_ids: contextFileIds,
      },
    },
  };
};

const buildOptions = (req, endpoint, parsedBody, endpointType) => {
  const { spec, iconURL, agent_id, ...model_parameters } = parsedBody;
  const agentPromise = loadAgent({
    req,
    spec,
    agent_id: isAgentsEndpoint(endpoint) ? agent_id : Constants.EPHEMERAL_AGENT_ID,
    endpoint,
    model_parameters,
  })
    .catch((error) => {
      logger.error(
        `[/agents/:${agent_id}] Error retrieving agent during build options step`,
        error,
      );
      return undefined;
    })
    .then(async (agent) => {
      try {
        return await mergeProjectContext({ req, agent });
      } catch (error) {
        logger.error(`[/agents/:${agent_id}] Error applying project context`, error);
        return agent;
      }
    });

  /** @type {import('librechat-data-provider').TConversation | undefined} */
  const addedConvo = req.body?.addedConvo;

  return removeNullishValues({
    spec,
    iconURL,
    endpoint,
    agent_id,
    endpointType,
    model_parameters,
    agent: agentPromise,
    addedConvo,
  });
};

module.exports = { buildOptions };
