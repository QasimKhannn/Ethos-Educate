const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { MongoMemoryServer } = require('mongodb-memory-server');

const rootDir = path.resolve(__dirname, '..');
// Only a value passed by the shell should override the local runner's config.
// .env also contains the deployment config path, which must not make
// `npm run backend:local` initialize remote MCP services.
const explicitConfigPath = process.env.CONFIG_PATH;

dotenv.config({ path: path.resolve(rootDir, '.env') });

// The Azure endpoint is configured explicitly in YAML. Keep local .env files
// that still use the legacy key working without enabling the deprecated global
// Azure configuration path.
if (!process.env.AZURE_OPENAI_API_KEY && process.env.AZURE_API_KEY) {
  process.env.AZURE_OPENAI_API_KEY = process.env.AZURE_API_KEY;
}
delete process.env.AZURE_API_KEY;

const truthy = new Set(['1', 'true', 'yes', 'on']);
const isEnabled = (value) =>
  truthy.has(
    String(value ?? '')
      .trim()
      .toLowerCase(),
  );

const useConfiguredMongo = isEnabled(process.env.LOCAL_USE_CONFIGURED_MONGO);
const enableOptionalServices = isEnabled(process.env.LOCAL_ENABLE_OPTIONAL_SERVICES);

let mongoServer;

async function stopMongo() {
  if (!mongoServer) {
    return;
  }

  await mongoServer.stop();
  mongoServer = undefined;
}

async function shutdown() {
  await stopMongo();
  process.exit(0);
}

async function configureMongo() {
  if (useConfiguredMongo) {
    if (!process.env.MONGO_URI) {
      throw new Error('LOCAL_USE_CONFIGURED_MONGO=true requires MONGO_URI to be set.');
    }

    console.info('[local-backend] Using MONGO_URI from the environment.');
    return;
  }

  mongoServer = await MongoMemoryServer.create({
    instance: {
      dbName: process.env.LOCAL_MONGO_DB_NAME || 'enterprise-chat-local',
    },
  });

  process.env.MONGO_URI = mongoServer.getUri();
  console.info(`[local-backend] Started ephemeral MongoDB at ${process.env.MONGO_URI}`);
}

function configureOptionalServices() {
  if (enableOptionalServices) {
    console.info('[local-backend] Optional services enabled from the environment.');
    return;
  }

  process.env.MEILI_HOST = '';
  process.env.MEILI_MASTER_KEY = '';
  process.env.RAG_API_URL = '';
  process.env.SEARCH = 'false';
  console.info('[local-backend] Optional Meilisearch and RAG services disabled.');
}

function configureLocalConfig() {
  const rootConfigPath = path.resolve(rootDir, 'librechat.yaml');

  if (explicitConfigPath) {
    process.env.CONFIG_PATH = explicitConfigPath;
    console.info(`[local-backend] Using explicit config at ${process.env.CONFIG_PATH}`);
    return;
  }

  process.env.CONFIG_PATH = fs.existsSync(rootConfigPath)
    ? rootConfigPath
    : path.resolve(__dirname, 'librechat.local.yaml');
  console.info(`[local-backend] Using local config at ${process.env.CONFIG_PATH}`);
}

async function start() {
  const startupStartedAt = process.hrtime.bigint();
  const logStartup = (message) => {
    const elapsedMs = Number(process.hrtime.bigint() - startupStartedAt) / 1_000_000;
    console.info(`[local-backend +${elapsedMs.toFixed(0)}ms] ${message}`);
  };

  logStartup('Preparing local backend configuration.');
  process.env.NODE_ENV = process.env.NODE_ENV || 'development';
  process.env.HOST = process.env.HOST || 'localhost';
  process.env.PORT = process.env.PORT || '3080';
  process.env.DOMAIN_SERVER = process.env.DOMAIN_SERVER || `http://localhost:${process.env.PORT}`;
  process.env.DOMAIN_CLIENT = process.env.DOMAIN_CLIENT || 'http://localhost:3090';

  configureLocalConfig();
  configureOptionalServices();
  await configureMongo();

  logStartup('Loading backend server modules.');
  require('../api/server/index.js');
  logStartup('Backend server modules loaded; application initialization is continuing.');
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);

start().catch(async (error) => {
  console.error('[local-backend] Failed to start:', error);
  await stopMongo();
  process.exit(1);
});
