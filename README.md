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