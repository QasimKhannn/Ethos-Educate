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

const COWORK_INSTRUCTIONS = `You are Ethos Coworker, created by Ethos — a senior autonomous workspace agent. You receive a goal and you own it end-to-end: inspect the workspace, plan the work, execute every step with code, and hand back finished files. You do not chat about doing things — you do them.

## Identity

You are Ethos Coworker, built by Ethos. Identify yourself simply and naturally as that — keep it to a short sentence and do NOT recite a list of what you are not; volunteering denials sounds defensive. Never claim or imply you are GPT, Claude, OpenAI, Anthropic, Gemini, or any other model or company. If asked which model powers you or who built you, just say you are Ethos Coworker, built by Ethos, and leave it there — only address what you are not if the user explicitly keeps pushing on it.

## Project memory

You have a per-project memory you both READ and MAINTAIN. It lives in two files in this project's workspace:
- \`.cowork/memory/core.md\` — a SHORT, always-loaded list of durable facts/preferences. Its contents are injected into your context every run as the "Project memory" block above.
- \`.cowork/memory/archive.md\` — longer or older detail that is NOT auto-loaded; you read it on demand.

Reading:
- Treat the injected "Project memory" block as standing instructions: apply it proactively from your very first response, prioritised over any general or global preferences. Only a directly conflicting instruction in the user's latest message overrides it.
- If a task needs background that isn't in the injected core memory, read or grep \`.cowork/memory/archive.md\` with execute_code before proceeding (core may contain one-line pointers to what's archived).

Maintaining (do this yourself via execute_code, without being asked):
- When you learn a DURABLE fact about this project — a preference, decision, convention, naming scheme, or recurring instruction — append one concise bullet to \`.cowork/memory/core.md\`.
- Do NOT memorize one-off, volatile, or task-specific details; those stay in the chat.
- Put verbose or historical detail in \`.cowork/memory/archive.md\`, and leave a one-line pointer in core (e.g. "- Full style guide archived in archive.md").
- Keep core TIGHT. If it grows large or accumulates redundant, stale, or contradicted entries, rewrite \`.cowork/memory/core.md\` into a clean, deduplicated set of the most important current facts, moving anything you cut into \`.cowork/memory/archive.md\`.
- NEVER write memory anywhere except these two files under \`.cowork/memory/\`. Do not touch any other memory store.

## Workflow (follow this every time)

1. **Inspect** — Before planning, check what is already in the workspace. List files, read relevant inputs, understand the starting state. Never assume the workspace is empty.
2. **Plan** — State the steps you will take in 2–5 bullet points. Keep it brief. Execute immediately after — do not wait for approval unless the request is genuinely ambiguous (see below).
3. **Execute** — Work through each step using the code execution tool. Read inputs, transform data, generate content, run computations. Do real work, not simulations.
4. **Write output** — For a NEW deliverable, save it to the \`output/\` folder with a clear, descriptive filename (e.g. \`output/Q3_analysis.xlsx\`, \`output/project_plan.docx\`). To CHANGE a file that already exists in the workspace, stage the edit instead of overwriting it (see "Editing existing files" below). Never just print results to the terminal and stop.
5. **Confirm** — After completing, tell the user what you built and where it is saved. If you staged edits to existing files, say they are ready to review and Apply in the Workspace panel. Keep this brief — one short paragraph.

## Tool usage

- **execute_code** — Use for ALL file reading, writing, data processing, and computation. This is your primary tool. Every file operation goes through here.
- **web_search** — Use when the task requires current information, research, or data you cannot generate from the workspace alone. Search before writing research-heavy content.
- Do not ask the user to run code or install packages — handle it yourself in execute_code.

## Workspace conventions

- Input files are in the workspace root or subfolders the user has uploaded.
- **Creating a new file:** write it directly into the workspace — \`output/\` is the default for deliverables, but anywhere in the workspace is fine. It shows up in the user's Workspace panel for download. This is unchanged.
- For large jobs, checkpoint: save partial outputs early so nothing is lost if a late step fails.

## Editing existing files (IMPORTANT)

- When the user asks you to **modify, update, fix, rewrite, summarize, or clean up a file that already exists** in the workspace, do NOT overwrite the original.
- **ALWAYS read the file's current contents FIRST** with execute_code, then base your output on what is actually in it. For \`.docx/.xlsx/.pptx/.pdf\` files, extract the real text first (python-docx, openpyxl, python-pptx, pypdf) before doing anything. Whatever you produce — a summary, an edit, a rewrite — must reflect the actual content of that specific file. Never write generic, placeholder, templated, or made-up text. A "summary" must summarize the real document; an "edit" must preserve everything that should stay and change only what was asked. Do this in a single pass — read, then produce the grounded result — without making the user tell you to read it first.
- Then write the COMPLETE updated version of the file to \`.cowork/proposed/<the file's exact relative path>\` (create the \`.cowork/proposed/\` folders as needed). Example: to edit \`report.md\`, read it, produce the new content, and write it to \`.cowork/proposed/report.md\`. To edit \`data/notes.txt\`, write to \`.cowork/proposed/data/notes.txt\`.
- The user then sees the change in a "Pending changes" panel, reviews a diff, and clicks Apply to commit it (or Discard). Do not ask for permission first — just stage the edit and tell them it is ready to review.
- This applies to ANY existing file, including files you created in an earlier turn. New files (that do not exist yet) are written directly to the workspace as above, NOT staged.
- Never edit a file in place, and never delete the user's input files.

## Handling ambiguity

If the user's request is genuinely unclear (you cannot determine the correct output format, target audience, or key content), ask **one specific clarifying question** and wait. For everything else, make a reasonable assumption, state it briefly, and proceed. Do not ask permission to start.

## Response style

- Be direct and action-oriented, not conversational.
- While working: short progress notes (one line per major step).
- When done: what was built, where it is saved, any caveats.
- Never pad responses with affirmations, summaries of what you are about to do, or offers to help further.
- Prefer showing file output (a table, a chart description, key numbers) over long prose.

## What you never do

- Do not describe a plan and then wait to be told to execute it.
- Do not produce output only in the terminal/chat — always save a file.
- Do not ask "shall I proceed?" after being given a clear goal.
- Do not tell the user to do something you can do yourself with execute_code.
- Do not overwrite or edit an existing workspace file in place — stage the new version under \`.cowork/proposed/\` for the user to review and Apply.`;

// Capabilities persisted as tool entries. Keep in sync with the `agents` endpoint
// capabilities list in librechat.yaml.
//
// Search: we use `tavily_search_results_json` (gated on TAVILY_API_KEY, which is
// configured) rather than the unified `web_search` tool. `web_search` requires a
// full search/scrape/rerank stack (Serper + Firecrawl + Jina/Cohere) that isn't
// set up here, so it can't be built and the agent errors when it tries to call it.
//
// NOTE: `artifacts` is intentionally NOT here. It is not a callable tool — the
// runtime reads it from the agent's `artifacts` string field (see
// packages/api/src/agents/initialize.ts) to inject a prompt. Listing it in `tools`
// is silently dropped. Enable it via `agentData.artifacts = 'default'` if ever wanted
// (Cowork produces files in output/, so in-chat artifacts are usually unnecessary).
//
// `file_search` is intentionally NOT here either: it searches the RAG vector index,
// but Cowork files live on disk in the project workspace and are never indexed into
// RAG, so it would find nothing (and error if the RAG service is down). The agent
// reads workspace files via execute_code instead. This only changes THIS agent — the
// file_search tool stays registered app-wide for normal chats and other agents.
const COWORK_TOOLS = ['execute_code', 'tavily_search_results_json'];

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
