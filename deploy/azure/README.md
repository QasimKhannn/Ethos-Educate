# Azure Serverless Deployment

This deployment target uses Azure Container Apps. The app is a long-running Express service with
streaming responses, uploads, background managers, optional MCP/code execution, and optional RAG
services, so Azure Functions is not a good fit for the main web/API process.

## Baseline resources

- Azure Container Apps environment for the LibreChat container.
- User-assigned managed identity attached to the container app.
- Azure Blob Storage account and private `files` container for user uploads, generated images,
  avatars, and document artifacts.
- Optional private `filecreation` container if the downloadable-file MCP/office-docs service is
  deployed.
- MongoDB-compatible database. MongoDB Atlas on Azure is the lowest-risk option for the existing
  Mongoose models. Azure Cosmos DB for MongoDB vCore can be evaluated separately.
- Azure Managed Redis for multi-replica deployments, OAuth/SAML sessions, rate limits, stream state,
  and cross-replica cache consistency.
- Optional: Azure AI Search for web/search tools if those features are enabled.
- Optional: RAG API plus vector storage if file search remains enabled. Use Azure Database for
  PostgreSQL Flexible Server with `pgvector`, or another managed vector store supported by the RAG
  service configuration.

## App configuration

Use `deploy/azure/librechat.azure.yaml` as the starting config:

```yaml
fileStrategy: azure_blob
secureImageLinks: true
```

The Azure config mirrors the active CSUSA MCP/model setup, but replaces deployment-specific service
URLs with environment variables such as `OUTLOOK_MCP_URL`, `WEBSEARCH_MCP_URL`,
`DOWNLOADABLE_FILES_MCP_URL`, and `CANVA_MCP_URL`. Set those to the final Azure Container Apps URLs
as each MCP service is migrated.

By default, `CONFIG_PATH` should be `/app/deploy/azure/librechat.azure.yaml`. The Docker build now
keeps this file in the image even though the root `.dockerignore` excludes other `librechat*` files.
Use an HTTPS URL only if you intentionally host the config separately.

For production, prefer Container Apps secrets or Key Vault references for secret values. Plain
runtime values can go in the `plainEnv` parameter, and secrets can go in `secretEnv`.

## Required runtime values

Minimum non-secret values:

- `HOST=0.0.0.0`
- `PORT=3080`
- `NODE_ENV=production`
- `DOMAIN_CLIENT=https://<container-app-fqdn-or-custom-domain>`
- `DOMAIN_SERVER=https://<container-app-fqdn-or-custom-domain>`
- `CONFIG_PATH=<https-url-or-mounted-path-to-librechat.yaml>`
- `AZURE_STORAGE_ACCOUNT_NAME=<created-storage-account>`
- `AZURE_CONTAINER_NAME=files`
- `AZURE_STORAGE_PUBLIC_ACCESS=false`
- `CONSOLE_JSON=true`
- `LIBRECHAT_LOG_DIR=/tmp/librechat-logs`
- MCP service URLs referenced by `deploy/azure/librechat.azure.yaml`

Minimum secrets:

- `MONGO_URI`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `CREDS_KEY`
- `CREDS_IV`
- `MEILI_MASTER_KEY` if `SEARCH=true`
- `REDIS_URI` if `USE_REDIS=true`
- OAuth and provider secrets referenced by `deploy/azure/librechat.azure.yaml`
- Model/provider keys such as `OPENAI_API_KEY`, Azure OpenAI keys, Google keys, etc.

Recommended scale-out values:

- `USE_REDIS=true`
- `USE_REDIS_STREAMS=true`
- `REDIS_KEY_PREFIX=<deployment-name>`
- `TRUST_PROXY=1`

If Meilisearch is not provisioned yet, set `SEARCH=false` or `MEILI_NO_SYNC=true` until it exists.
If the RAG API is not provisioned yet, omit `RAG_API_URL` and disable file-search workflows that
depend on it.
If `CANVA_MCP_URL` still points to localhost in an existing config, deploy the Canva MCP bridge as
a service or replace it with a reachable hosted MCP endpoint before enabling it.

Container-local values from Docker Compose must be replaced before deployment:

- `HOST=localhost` -> `HOST=0.0.0.0`
- `MEILI_HOST=http://0.0.0.0:7700` -> the Meilisearch Container App/service URL
- `RAG_API_URL=http://host.docker.internal:8000` -> the RAG API Container App/service URL
- `SD_WEBUI_URL=http://host.docker.internal:7860` -> the deployed Stable Diffusion service URL, or
  omit it

## Deploy

Create or reuse an Azure Container Registry, build and push the application image, then deploy the
Bicep template:

```bash
az acr build \
  --registry <registry-name> \
  --image csusa-librechat:latest \
  .

az deployment group create \
  --resource-group <resource-group> \
  --template-file deploy/azure/main.bicep \
  --parameters @deploy/azure/main.parameters.example.json
```

After the first deployment:

- Grant the app identity any additional Azure service roles it needs.
- Add a custom domain and update `DOMAIN_CLIENT` / `DOMAIN_SERVER`.
- Restart or create a new revision after secret changes.
- Keep `AZURE_STORAGE_CONNECTION_STRING` unset when using managed identity.

## GitHub Actions CI/CD

The `.github/workflows/azure-serverless.yml` workflow runs build and deployment checks on every
push and pull request. Deployment only runs on push after all checks pass.

Branch behavior:

- Pushes to `STAGING_BRANCH` deploy to `STAGING_APP_NAME` and keep the stable staging URL.
- Pushes to any other branch deploy an isolated preview Container App with a deterministic branch
  name and its own Azure-generated URL.
- Pull requests run checks only and do not deploy.
- Deleting a preview branch removes Azure resources tagged for that preview app.

Required GitHub environment secrets for deployment:

- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`
- `MONGO_URI`
- `CREDS_KEY`
- `CREDS_IV`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `OPENID_CLIENT_ID`
- `OPENID_CLIENT_SECRET`
- `OPENID_SESSION_SECRET`
- `MICROSOFT_CLIENT_SECRET`
- `CANVA_CLIENT_SECRET`
- `AZURE_API_KEY`
- `GOOGLE_KEY`
- `GEMINI_API_KEY`

Required or recommended GitHub environment variables:

- `AZURE_RESOURCE_GROUP`
- `ACR_NAME`
- `ACR_LOGIN_SERVER`
- `MICROSOFT_TENANT_ID`
- `MICROSOFT_CLIENT_ID`
- `CANVA_CLIENT_ID`
- `AZURE_IMAGE_BASE_URL`
- `STAGING_BRANCH`
- `STAGING_APP_NAME`
- `APP_NAME_PREFIX`

Set `SEARCH=true` only after `MEILI_HOST` and `MEILI_MASTER_KEY` are configured. Set
`USE_REDIS=true` only after `REDIS_URI` is configured. The deployment script intentionally fails
before deploying when required runtime values are missing.

Preview branch URLs are random Azure Container Apps domains. OAuth providers that require exact
redirect URI registration, including Okta, Microsoft, and Canva, must either have each preview
callback URL registered or those OAuth flows will only work on the registered staging/custom domain.
