const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { MongoMemoryServer } = require('mongodb-memory-server');

const rootDir = path.resolve(__dirname, '..');

dotenv.config({ path: path.resolve(rootDir, '.env') });

const truthy = new Set(['1', 'true', 'yes', 'on']);
const isEnabled = (value) => truthy.has(String(value ?? '').trim().toLowerCase());

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

  if (process.env.CONFIG_PATH || fs.existsSync(rootConfigPath)) {
    return;
  }

  process.env.CONFIG_PATH = path.resolve(__dirname, 'librechat.local.yaml');
  console.info(`[local-backend] Using local config at ${process.env.CONFIG_PATH}`);
}

async function start() {
  process.env.NODE_ENV = process.env.NODE_ENV || 'development';
  process.env.HOST = process.env.HOST || 'localhost';
  process.env.PORT = process.env.PORT || '3080';
  process.env.DOMAIN_SERVER = process.env.DOMAIN_SERVER || `http://localhost:${process.env.PORT}`;
  process.env.DOMAIN_CLIENT = process.env.DOMAIN_CLIENT || 'http://localhost:3090';

  configureLocalConfig();
  configureOptionalServices();
  await configureMongo();

  require('../api/server/index.js');
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);

start().catch(async (error) => {
  console.error('[local-backend] Failed to start:', error);
  await stopMongo();
  process.exit(1);
});
