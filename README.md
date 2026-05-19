# We Build Testing

This repository now includes the Step 1 local application skeleton described in `docs/app-plan.md`:

- `apps/web`: React + TypeScript frontend served locally with Vite
- `apps/api`: TypeScript local API with a `/health` endpoint
- `.env`: shared local port and URL configuration for both services

## Run locally

Install dependencies:

```bash
npm install
```

Start both services:

```bash
npm run dev
```

Expected local URLs:

- Frontend: `http://localhost:5173`
- API health: `http://localhost:4000/health`

## Verification

1. Run `npm run dev`.
2. Open `http://localhost:5173` and confirm the frontend renders.
3. Open `http://localhost:4000/health` and confirm the API responds with JSON.

## API verification script

With the local API running, execute:

```bash
npm run verify:api
```

The script checks health, adapter-backed vendor listing, session creation, session reload, and a PID step update that should unlock company initiation.

## iGrant vendor configuration

The `igrant-sandbox` vendor uses real HTTP calls from the local API to the iGrant Product API.
Configure these variables before using that vendor in the UI:

```bash
IGRANT_BASE_URL=https://demo-api.igrant.io
IGRANT_AUTH_SCHEME=Bearer
IGRANT_API_KEY=...
IGRANT_PERSONAL_CREDENTIAL_DEFINITION_ID=...
IGRANT_POA_CREDENTIAL_DEFINITION_ID=...
IGRANT_EUCC_CREDENTIAL_DEFINITION_ID=...
IGRANT_VAT_CREDENTIAL_DEFINITION_ID=...
```

The app uses repository fixture data as test claims, but sends those claims through iGrant to external wallet applications rather than the in-app mock wallets.

Both vendor profiles also expose wallet seeding for operator testing. For `mock-local`, the app stores fixture summaries directly in local session state. For `igrant-sandbox`, the seed action calls the vendor issuance API, creates a real OID4VCI offer, and the UI renders a QR code plus deep-link for scanning with a real wallet.

## Azure installation and deployment

An Azure deployment plan for this repository is available in `.azure/plan.copilotmd`.

It contains:

- the recommended Azure resource layout,
- required environment variable mapping for both services,
- and step-by-step Azure CLI provisioning and deployment commands.

## GitHub Actions deployment

This repository includes an Azure deployment workflow at `.github/workflows/deploy-azure.yml`.

Triggers:

- push to `main`
- manual run from Actions (`workflow_dispatch`)

Required repository secrets:

- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`
- `AZURE_RESOURCE_GROUP`
- `AZURE_WEBAPP_API_NAME`
- `AZURE_WEBAPP_WEB_NAME`

The workflow will:

1. install dependencies and run type checks,
2. log in to Azure using OIDC,
3. set both Web Apps to Node 24 LTS runtime,
4. apply startup/app settings for API and Web,
5. deploy the repository package to both apps.