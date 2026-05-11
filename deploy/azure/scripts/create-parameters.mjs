import fs from 'fs';

const required = (name) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const compact = (object) =>
  Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  );

const envValue = (name, fallback = '') => process.env[name] || fallback;
const isEnabled = (name) => ['1', 'true', 'yes'].includes(envValue(name).toLowerCase());
const numberEnv = (name, fallback) => {
  const value = Number(envValue(name, fallback));

  if (!Number.isFinite(value)) {
    throw new Error(`Environment variable ${name} must be a number`);
  }

  return value;
};

const assertRuntimeConfiguration = () => {
  if (!isEnabled('REQUIRE_RUNTIME_SECRETS')) {
    return;
  }

  const requiredRuntimeValues = [
    'MONGO_URI',
    'CREDS_KEY',
    'CREDS_IV',
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'OPENID_CLIENT_ID',
    'OPENID_CLIENT_SECRET',
    'OPENID_SESSION_SECRET',
    'MICROSOFT_TENANT_ID',
    'MICROSOFT_CLIENT_ID',
    'MICROSOFT_CLIENT_SECRET',
    'CANVA_CLIENT_ID',
    'CANVA_CLIENT_SECRET',
    'AZURE_API_KEY',
    'GOOGLE_KEY',
    'GEMINI_API_KEY',
  ];

  const featureRequiredValues = [
    ...(isEnabled('SEARCH') ? ['MEILI_HOST', 'MEILI_MASTER_KEY'] : []),
    ...(isEnabled('USE_REDIS') ? ['REDIS_URI'] : []),
  ];

  const missing = [...requiredRuntimeValues, ...featureRequiredValues].filter((name) => !process.env[name]);

  if (missing.length) {
    throw new Error(`Missing required deployment environment variables: ${missing.join(', ')}`);
  }
};

const appName = required('APP_NAME');
const appUrl = required('APP_URL');
const image = required('AZURE_CONTAINER_IMAGE');
const outputPath = envValue('PARAMETERS_PATH', '/tmp/azure.parameters.json');

assertRuntimeConfiguration();

const plainEnv = compact({
  CONFIG_PATH: '/app/deploy/azure/librechat.azure.yaml',
  DOMAIN_CLIENT: appUrl,
  DOMAIN_SERVER: appUrl,
  APP_TITLE: envValue('APP_TITLE', 'CSUSA Staging'),
  CUSTOM_FOOTER: envValue('CUSTOM_FOOTER', 'CSUSA Staging'),
  HELP_AND_FAQ_URL: envValue('HELP_AND_FAQ_URL', 'https://helpdesk.charterschoolsusa.com/support/home'),
  NO_INDEX: envValue('NO_INDEX', 'true'),
  DEBUG_LOGGING: envValue('DEBUG_LOGGING', 'false'),
  DEBUG_CONSOLE: envValue('DEBUG_CONSOLE', 'false'),
  SEARCH: envValue('SEARCH', 'false'),
  MEILI_NO_ANALYTICS: envValue('MEILI_NO_ANALYTICS', 'true'),
  MEILI_HOST: envValue('MEILI_HOST'),
  USE_REDIS: envValue('USE_REDIS', 'false'),
  USE_REDIS_STREAMS: envValue('USE_REDIS_STREAMS', ''),
  REDIS_KEY_PREFIX: envValue('REDIS_KEY_PREFIX', appName),
  MCP_ENABLED: envValue('MCP_ENABLED', 'true'),
  EXPERIMENTAL_AGENTS: envValue('EXPERIMENTAL_AGENTS', 'true'),
  ALLOW_EMAIL_LOGIN: envValue('ALLOW_EMAIL_LOGIN', 'true'),
  ALLOW_REGISTRATION: envValue('ALLOW_REGISTRATION', 'true'),
  ALLOW_SOCIAL_LOGIN: envValue('ALLOW_SOCIAL_LOGIN', 'false'),
  ALLOW_SOCIAL_REGISTRATION: envValue('ALLOW_SOCIAL_REGISTRATION', 'false'),
  ALLOW_PASSWORD_RESET: envValue('ALLOW_PASSWORD_RESET', 'false'),
  ALLOW_UNVERIFIED_EMAIL_LOGIN: envValue('ALLOW_UNVERIFIED_EMAIL_LOGIN', 'true'),
  SESSION_EXPIRY: envValue('SESSION_EXPIRY', '1000 * 60 * 15'),
  REFRESH_TOKEN_EXPIRY: envValue('REFRESH_TOKEN_EXPIRY', '(1000 * 60 * 60 * 24) * 7'),
  LIMIT_CONCURRENT_MESSAGES: envValue('LIMIT_CONCURRENT_MESSAGES', 'true'),
  CONCURRENT_MESSAGE_MAX: envValue('CONCURRENT_MESSAGE_MAX', '2'),
  LIMIT_MESSAGE_IP: envValue('LIMIT_MESSAGE_IP', 'true'),
  MESSAGE_IP_MAX: envValue('MESSAGE_IP_MAX', '40'),
  MESSAGE_IP_WINDOW: envValue('MESSAGE_IP_WINDOW', '1'),
  LIMIT_MESSAGE_USER: envValue('LIMIT_MESSAGE_USER', 'false'),
  MESSAGE_USER_MAX: envValue('MESSAGE_USER_MAX', '40'),
  MESSAGE_USER_WINDOW: envValue('MESSAGE_USER_WINDOW', '1'),
  ALLOW_SHARED_LINKS: envValue('ALLOW_SHARED_LINKS', 'true'),
  ALLOW_SHARED_LINKS_PUBLIC: envValue('ALLOW_SHARED_LINKS_PUBLIC', 'false'),
  OPENID_ISSUER: envValue('OPENID_ISSUER', 'https://identity-mgr.okta.com/oauth2/default'),
  OPENID_SCOPE: envValue('OPENID_SCOPE', 'openid profile email'),
  OPENID_CALLBACK_URL: envValue('OPENID_CALLBACK_URL', '/oauth/openid/callback'),
  GOOGLE_MODELS: envValue('GOOGLE_MODELS', 'gemini-3-pro-preview,gemini-2.5-flash'),
  MICROSOFT_TENANT_ID: envValue('MICROSOFT_TENANT_ID'),
  MICROSOFT_CLIENT_ID: envValue('MICROSOFT_CLIENT_ID'),
  MICROSOFT_CALLBACK_URL: envValue('MICROSOFT_CALLBACK_URL', '/oauth/callback'),
  CANVA_CLIENT_ID: envValue('CANVA_CLIENT_ID'),
  AZURE_IMAGE_BASE_URL: envValue('AZURE_IMAGE_BASE_URL'),
  OUTLOOK_MCP_URL: envValue(
    'OUTLOOK_MCP_URL',
    'https://outlook-mcp-1081644116068.us-central1.run.app/mcp',
  ),
  OUTLOOK_MCP_REDIRECT_URI: `${appUrl}/api/mcp/outlook/oauth/callback`,
  TEAMS_MCP_URL: envValue(
    'TEAMS_MCP_URL',
    'https://teams-chat-mcp-1081644116068.us-central1.run.app/mcp',
  ),
  TEAMS_MCP_REDIRECT_URI: `${appUrl}/api/mcp/teams/oauth/callback`,
  SHAREPOINT_MCP_URL: envValue(
    'SHAREPOINT_MCP_URL',
    'https://sharepoint-mcp-1081644116068.us-central1.run.app/mcp',
  ),
  SHAREPOINT_MCP_REDIRECT_URI: `${appUrl}/api/mcp/sharepoint/oauth/callback`,
  ONEDRIVE_MCP_URL: envValue(
    'ONEDRIVE_MCP_URL',
    'https://onedrive-mcp-1081644116068.us-central1.run.app/mcp',
  ),
  ONEDRIVE_MCP_REDIRECT_URI: `${appUrl}/api/mcp/onedrive/oauth/callback`,
  WEBSEARCH_MCP_URL: envValue(
    'WEBSEARCH_MCP_URL',
    'https://web-search-mcp.mangoocean-84242d32.eastus.azurecontainerapps.io/mcp',
  ),
  LESSON_PLANNING_MCP_URL: envValue(
    'LESSON_PLANNING_MCP_URL',
    'https://lesson-planning-mcp-3fixl7mkma-uc.a.run.app/mcp',
  ),
  DOWNLOADABLE_FILES_MCP_URL: envValue(
    'DOWNLOADABLE_FILES_MCP_URL',
    'https://csusafiledownloadmcp.mangoocean-84242d32.eastus.azurecontainerapps.io/mcp',
  ),
  CANVA_MCP_URL: envValue('CANVA_MCP_URL', 'https://mcp.canva.com/mcp'),
  CANVA_MCP_REDIRECT_URI: `${appUrl}/api/mcp/canva/oauth/callback`,
  AZURE_STORAGE_CONTAINER: envValue('AZURE_STORAGE_CONTAINER', 'filecreation'),
  ENABLE_SECURE_DOWNLOADS: envValue('ENABLE_SECURE_DOWNLOADS', 'true'),
  MIDDLEWARE_BASE_URL: appUrl,
  FILE_EXPIRY_DAYS: envValue('FILE_EXPIRY_DAYS', '1'),
  MAX_DOWNLOADS_PER_USER_PER_HOUR: envValue('MAX_DOWNLOADS_PER_USER_PER_HOUR', '15'),
  ENABLE_AUDIT_LOG: envValue('ENABLE_AUDIT_LOG', 'true'),
  LOG_LEVEL: envValue('LOG_LEVEL', 'INFO'),
  NETSUITE_1_SANDBOX_ID: envValue('NETSUITE_1_SANDBOX_ID'),
  NETSUITE_2_SANDBOX_ID: envValue('NETSUITE_2_SANDBOX_ID'),
  NETSUITE_3_SANDBOX_ID: envValue('NETSUITE_3_SANDBOX_ID'),
  NETSUITE_OAUTH_CALLBACK_LOCAL: envValue('NETSUITE_OAUTH_CALLBACK_LOCAL', `${appUrl}/oauth/callback`),
  NETSUITE_OAUTH_CALLBACK_PROD: envValue('NETSUITE_OAUTH_CALLBACK_PROD', `${appUrl}/oauth/callback`),
  OKTA_DOMAIN: envValue('OKTA_DOMAIN'),
  VITE_FEEDBACK_FORM_URL: envValue('VITE_FEEDBACK_FORM_URL'),
});

const secretKeys = [
  'MONGO_URI',
  'REDIS_URI',
  'CREDS_KEY',
  'CREDS_IV',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'OPENID_CLIENT_ID',
  'OPENID_CLIENT_SECRET',
  'OPENID_SESSION_SECRET',
  'MICROSOFT_CLIENT_SECRET',
  'CANVA_CLIENT_SECRET',
  'AZURE_API_KEY',
  'AZURE_OPENAI_API_KEY',
  'AZURE_IMAGE_API_KEY',
  'GOOGLE_KEY',
  'GEMINI_API_KEY',
  'TTS_API_KEY',
  'WEB_SEARCH_API_KEY',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'OKTA_CLIENT_ID',
  'OKTA_CLIENT_SECRET',
  'NETSUITE_1_CONSUMER_KEY',
  'NETSUITE_1_CONSUMER_SECRET',
  'NETSUITE_1_OAUTH_CLIENT_ID',
  'NETSUITE_1_OAUTH_CLIENT_SECRET',
  'NETSUITE_2_CONSUMER_KEY',
  'NETSUITE_2_CONSUMER_SECRET',
  'NETSUITE_2_OAUTH_CLIENT_ID',
  'NETSUITE_2_OAUTH_CLIENT_SECRET',
  'NETSUITE_3_CONSUMER_KEY',
  'NETSUITE_3_CONSUMER_SECRET',
  'NETSUITE_3_OAUTH_CLIENT_ID',
  'NETSUITE_3_OAUTH_CLIENT_SECRET',
  'MEILI_MASTER_KEY',
  'BINGAI_TOKEN',
  'GOOGLE_SEARCH_API_KEY',
  'SERPAPI_API_KEY',
  'TAVILY_API_KEY',
  'TRAVERSAAL_API_KEY',
  'WOLFRAM_APP_ID',
  'ZAPIER_NLA_API_KEY',
];

const secretEnv = Object.fromEntries(
  secretKeys.filter((key) => process.env[key]).map((key) => [key, process.env[key]]),
);

const params = {
  $schema: 'https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#',
  contentVersion: '1.0.0.0',
  parameters: {
    appName: { value: appName },
    location: { value: envValue('AZURE_LOCATION', 'eastus2') },
    image: { value: image },
    containerRegistryName: { value: envValue('ACR_NAME', 'educhatstagingcicd') },
    containerRegistryServer: {
      value: envValue('ACR_LOGIN_SERVER', 'educhatstagingcicd.azurecr.io'),
    },
    containerRegistryUsername: { value: envValue('ACR_USERNAME') },
    containerRegistryPassword: { value: envValue('ACR_PASSWORD') },
    createRoleAssignments: { value: isEnabled('CREATE_ROLE_ASSIGNMENTS') },
    useStorageConnectionString: {
      value: !['0', 'false', 'no'].includes(
        envValue('USE_STORAGE_CONNECTION_STRING', 'true').toLowerCase(),
      ),
    },
    minReplicas: { value: numberEnv('MIN_REPLICAS', '1') },
    maxReplicas: { value: numberEnv('MAX_REPLICAS', '1') },
    cpuCores: { value: envValue('CPU_CORES', '1.0') },
    memorySize: { value: envValue('MEMORY_SIZE', '2Gi') },
    storageContainerName: { value: envValue('AZURE_CONTAINER_NAME', 'files') },
    additionalStorageContainerNames: { value: ['filecreation'] },
    plainEnv: { value: plainEnv },
    secretEnv: { value: secretEnv },
    resourceTags: {
      value: compact({
        branchName: envValue('GITHUB_REF_NAME'),
        commitSha: envValue('GITHUB_SHA'),
        repository: envValue('GITHUB_REPOSITORY'),
      }),
    },
  },
};

fs.writeFileSync(outputPath, JSON.stringify(params, null, 2));
fs.chmodSync(outputPath, 0o600);
console.log(outputPath);
