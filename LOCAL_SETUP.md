# Local Setup

This repo can run in two local modes:

1. Node mode with an ephemeral MongoDB:

   ```powershell
   npm ci
   npm run build
   npm run backend:local
   ```

   The backend serves the production frontend at `http://localhost:3080`.

2. Split frontend/backend development:

   ```powershell
   npm run backend:local
   npm run frontend:local
   ```

   The Vite frontend runs at `http://localhost:3090` and proxies API traffic to the backend.

## Local Backend Defaults

`npm run backend:local` starts MongoDB through `mongodb-memory-server`, using the existing development dependency already present in the repo. This is intentionally ephemeral: data resets when the backend exits.

By default it also disables local Meilisearch and RAG calls so the app can boot on a machine without Docker or those services installed.

If the project root does not have `librechat.yaml`, the local launcher uses `config/librechat.local.yaml`, a minimal valid config for local startup.

Use these environment flags when you want the local backend to use external services:

```powershell
$env:LOCAL_USE_CONFIGURED_MONGO='true'
$env:LOCAL_ENABLE_OPTIONAL_SERVICES='true'
npm run backend:local
```

`LOCAL_USE_CONFIGURED_MONGO=true` uses `MONGO_URI` from `.env`.
`LOCAL_ENABLE_OPTIONAL_SERVICES=true` keeps `MEILI_HOST`, `MEILI_MASTER_KEY`, `RAG_API_URL`, and `SEARCH` from `.env`.

## Docker Notes

Docker is optional for Node mode, but required if you want the Compose stack for MongoDB, Meilisearch, vector DB, and RAG API. Install Docker Desktop or add Docker to `PATH` before using:

```powershell
docker compose up
```

## Common Commands

```powershell
npm run build
npm run backend:local
npm run backend
npm run frontend:local
npm run frontend:dev
npm run test:all
```
