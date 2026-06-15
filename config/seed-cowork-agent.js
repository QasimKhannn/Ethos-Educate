require('dotenv').config();
const path = require('path');
const mongoose = require('mongoose');
const {
  SystemRoles,
  ResourceType,
  AccessRoleIds,
  PrincipalType,
} = require('librechat-data-provider');
const { User } = require('@librechat/data-schemas').createModels(mongoose);
require('module-alias')({ base: path.resolve(__dirname, '..', 'api') });
const { silentExit } = require('./helpers');
const connect = require('./connect');

// cowork — Seeds (or updates) the dedicated Cowork agent.
//
// Cowork runs on EduChat's existing `@librechat/agents` engine; this script just
// persists a known agent definition with the Cowork capability set so the feature
// has a consistent "brain" to attach the workspace, skills, and trace UI to.
//
// Capabilities are stored as entries in the agent's `tools` array (this is how the
// LibreChat agent builder persists them). Each must also be enabled on the `agents`
// endpoint in librechat.yaml (execute_code, file_search, artifacts, web_search,
// actions are enabled there).
//
// Usage:
//   npm run seed-cowork-agent -- [authorEmail] [provider] [model]
//   node config/seed-cowork-agent.js [authorEmail] [provider] [model]
//
// Defaults: author = first ADMIN user, provider = azureOpenAI, model = gpt-5-chat
//           (model is the librechat.yaml model key, which maps to deployment gpt-5.2-chat)
// Idempotent: re-running updates the existing agent in place (fixed id).

const COWORK_AGENT_ID = 'agent_cowork_default';

const COWORK_INSTRUCTIONS = `You are the Ethos Coworker — an autonomous workspace agent. You are given an outcome, and you plan and execute the entire multi-step job, returning finished deliverable files.

Operating rules:
- Plan first. Briefly lay out the steps before doing the work, then execute them.
- Work in the project workspace. Read inputs from the workspace and save every deliverable into the workspace 'output/' folder so the user can find and download it.
- Use the code execution tool for all file reading, writing, and processing — do not ask the user to run code.
- Show your progress as you go: what you are doing and what you produced.
- When a step fails, retry transient failures briefly; if it keeps failing, stop and report what happened with any partial output preserved.
- Hand back concrete files, not just descriptions.`;

// Capabilities persisted as tool entries. Keep in sync with the `agents` endpoint
// capabilities list in librechat.yaml.
const COWORK_TOOLS = ['execute_code', 'file_search', 'web_search', 'artifacts'];

(async () => {
  await connect();

  console.purple('--------------------------');
  console.purple('Seed the Cowork agent');
  console.purple('--------------------------');

  // Resolve the author (an admin user is required as the agent owner).
  const email = process.argv[2];
  let user;

  if (email && email.includes('@')) {
    user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) {
      console.red(`Error: No user found with email ${email}`);
      silentExit(1);
    }
  } else {
    user = await User.findOne({ role: SystemRoles.ADMIN }).sort({ createdAt: 1 });
    if (!user) {
      console.red('Error: No ADMIN user found. Create/promote one first (config/promote-admin.js).');
      silentExit(1);
    }
    console.orange(`No author email given — using first admin: ${user.email}`);
  }

  const provider = process.argv[3] || 'azureOpenAI';
  // NOTE: this is the azureOpenAI endpoint's model *key* in librechat.yaml
  // (gpt-5-chat -> deploymentName gpt-5.2-chat), not the Azure deployment name.
  const model = process.argv[4] || 'gpt-5-chat';

  // Require the model/service helpers after alias setup so `~` resolves.
  const { getAgent, createAgent, updateAgent } = require('~/models/Agent');
  const { grantPermission } = require('~/server/services/PermissionService');

  const agentData = {
    id: COWORK_AGENT_ID,
    name: 'Cowork',
    description: 'Autonomous workspace agent: turns a goal into finished deliverables.',
    instructions: COWORK_INSTRUCTIONS,
    provider,
    model,
    tools: COWORK_TOOLS,
    category: 'general',
    author: user._id,
    authorName: user.name || user.username || user.email,
  };

  const existing = await getAgent({ id: COWORK_AGENT_ID });

  let agent;
  if (existing) {
    agent = await updateAgent({ id: COWORK_AGENT_ID }, agentData);
    console.green(`Updated existing Cowork agent (${COWORK_AGENT_ID}).`);
  } else {
    agent = await createAgent(agentData);
    console.green(`Created Cowork agent (${COWORK_AGENT_ID}).`);
  }

  // Mirror the agent builder's create flow (controllers/agents/v1.js): grant the
  // author owner access via the ACL. Without this the agent doc exists but is
  // invisible to the agent-list query in the UI. Re-running is safe — grants are
  // wrapped so an already-existing grant won't fail the script.
  const resourceId =
    (agent && agent._id) || (await getAgent({ id: COWORK_AGENT_ID }))._id;

  try {
    await grantPermission({
      principalType: PrincipalType.USER,
      principalId: user._id,
      resourceType: ResourceType.AGENT,
      resourceId,
      accessRoleId: AccessRoleIds.AGENT_OWNER,
      grantedBy: user._id,
    });
    console.green('Granted AGENT_OWNER access to author.');
  } catch (err) {
    console.orange(`AGENT_OWNER grant skipped (may already exist): ${err.message}`);
  }

  try {
    await grantPermission({
      principalType: PrincipalType.USER,
      principalId: user._id,
      resourceType: ResourceType.REMOTE_AGENT,
      resourceId,
      accessRoleId: AccessRoleIds.REMOTE_AGENT_OWNER,
      grantedBy: user._id,
    });
  } catch (err) {
    console.orange(`REMOTE_AGENT_OWNER grant skipped: ${err.message}`);
  }

  console.purple(`  provider: ${provider}`);
  console.purple(`  model:    ${model}`);
  console.purple(`  tools:    ${COWORK_TOOLS.join(', ')}`);
  console.purple(`  author:   ${user.email}`);

  silentExit(0);
})();

process.on('uncaughtException', (err) => {
  if (!err.message.includes('fetch failed')) {
    console.error('There was an uncaught error:');
    console.error(err);
  }
  if (err.message.includes('fetch failed')) {
    return;
  }
  process.exit(1);
});
