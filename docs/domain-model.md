# Domain Model

Step 3 defines one vendor-neutral workflow model that both the frontend and the local API can share.

## Core concepts

- `VendorDefinition`: selected vendor metadata and capability flags.
- `OrchestrationSession`: the canonical workflow session shape.
- `WorkflowStep<T>`: normalized status, data, and error envelope for each step.
- `NormalizedError`: one error structure used across UI, session API, and vendor adapters.

`VendorDefinition` also identifies how each vendor interacts with wallets:

- `local-mock-wallet`: the app can manage seeded test credentials in local session state.
- `external-wallet-app`: credentials live in real wallet applications outside this app and must be requested through the vendor adapter flow.

Wallet interaction mode does not decide whether test seeding is available. That is controlled separately through vendor capability flags so an external-wallet vendor can still issue mock credentials through its real OID4VCI path for operator testing.

## Workflow order

1. `pid`
2. `poa`
3. `eucc`
4. `review`
5. `vatIssuance`

## Status model

Each workflow step uses the same status values:

- `not-started`
- `ready`
- `blocked`
- `pending`
- `succeeded`
- `failed`

This guarantees that PID, PoA, EUCC, review, and VAT issuance all support pending, success, and failure states without exposing vendor payloads directly to the UI.

## Normalized records

- `PidRecord`: person identity fields needed by the app.
- `CompanyContext`: normalized company data derived from the collected organisation evidence.
- `PoaRecord`: representation power details tied to the person and company.
- `EuccRecord`: organization attestation summary from the company wallet.
- `ReviewPayload`: assembled operator review object.
- `VatIssuanceResult`: tracked result of VAT issuance.

## Rendering rule

Frontend components should render from `OrchestrationSession` and derived workflow snapshots only. Raw vendor payloads stay outside the UI layer.

Wallet inventory shown in the session is authoritative only for local mock testing. For external-wallet vendors, wallet entries may also carry OID4VCI offer details such as deep-link URI, exchange id, and user PIN so the UI can present a QR code for real-wallet pickup while the live wallet state still remains external to this app.