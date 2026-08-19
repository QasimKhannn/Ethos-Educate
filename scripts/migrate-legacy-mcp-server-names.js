require('dotenv').config();

const mongoose = require('mongoose');
const { Constants } = require('librechat-data-provider');

const { mcp_delimiter: mcpDelimiter } = Constants;

const serverAliases = new Map([
  ['websearch', 'websearch'],
  ['imagegeneration', 'Image_Generation'],
]);

function getCanonicalServerName(serverName) {
  const lookupKey = String(serverName).trim().replace(/[-_\s]+/g, '').toLowerCase();
  return serverAliases.get(lookupKey) ?? serverName;
}

function remapToolId(toolId) {
  const delimiterIndex = toolId.lastIndexOf(mcpDelimiter);
  if (delimiterIndex < 0) {
    return toolId;
  }

  const serverName = toolId.slice(delimiterIndex + mcpDelimiter.length);
  const canonicalServerName = getCanonicalServerName(serverName);
  if (canonicalServerName === serverName) {
    return toolId;
  }

  return `${toolId.slice(0, delimiterIndex + mcpDelimiter.length)}${canonicalServerName}`;
}

function remapToolOptions(toolOptions) {
  if (!toolOptions || typeof toolOptions !== 'object' || Array.isArray(toolOptions)) {
    return toolOptions;
  }

  return Object.fromEntries(
    Object.entries(toolOptions).map(([toolId, options]) => [remapToolId(toolId), options]),
  );
}

function getMCPServerNames(tools) {
  const serverNames = new Set();

  for (const toolId of tools ?? []) {
    const delimiterIndex = toolId.lastIndexOf(mcpDelimiter);
    if (delimiterIndex >= 0) {
      serverNames.add(toolId.slice(delimiterIndex + mcpDelimiter.length));
    }
  }

  return Array.from(serverNames);
}

function remapAgentData(agentData) {
  if (!agentData || typeof agentData !== 'object') {
    return agentData;
  }

  const tools = Array.isArray(agentData.tools) ? agentData.tools.map(remapToolId) : agentData.tools;
  const toolOptions = remapToolOptions(agentData.tool_options);

  return {
    ...agentData,
    ...(tools ? { tools, mcpServerNames: getMCPServerNames(tools) } : {}),
    ...(toolOptions ? { tool_options: toolOptions } : {}),
  };
}

function hasChanged(before, after) {
  return JSON.stringify(before) !== JSON.stringify(after);
}

async function migrate() {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI must be set.');
  }

  await mongoose.connect(process.env.MONGO_URI);
  const agents = mongoose.connection.db.collection('agents');
  const documents = await agents.find({}).toArray();
  const updates = documents.flatMap((agent) => {
    const updatedAgent = remapAgentData(agent);
    const updatedVersions = Array.isArray(agent.versions)
      ? agent.versions.map(remapAgentData)
      : agent.versions;

    if (!hasChanged(agent.tools, updatedAgent.tools) && !hasChanged(agent.versions, updatedVersions)) {
      return [];
    }

    return [
      {
        updateOne: {
          filter: { _id: agent._id },
          update: {
            $set: {
              tools: updatedAgent.tools,
              mcpServerNames: updatedAgent.mcpServerNames,
              tool_options: updatedAgent.tool_options,
              versions: updatedVersions,
            },
          },
        },
      },
    ];
  });

  if (updates.length === 0) {
    console.info('No legacy MCP server names found.');
    return;
  }

  const result = await agents.bulkWrite(updates, { ordered: false });
  console.info(`Updated ${result.modifiedCount} agent records with canonical MCP server names.`);
}

migrate()
  .catch((error) => {
    console.error('Legacy MCP server name migration failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
