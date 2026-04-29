# Vendor Adapter Contract

Step 5 introduces one backend adapter contract for all vendor operations.

## Contract location

- API contract: `apps/api/src/vendors/contract.ts`
- Adapter registry: `apps/api/src/vendors/registry.ts`

## Responsibilities

Each `VendorAdapter` must provide:

- `requestPid(session)`
- `requestPoa(session)`
- `requestEucc(session)`
- `assembleReview(session)`
- `submitVatIssuance(session)`
- `readIssuanceStatus(session)`

Each adapter also exposes one `definition` object containing the vendor label, description, badge, and capability flags.

Each definition also declares wallet interaction mode for the personal and company wallets:

- `local-mock-wallet` for local fixture-driven testing inside this app.
- `external-wallet-app` for vendor testing with real wallet applications outside this app.

Vendor capability flags separately declare whether wallet seeding is available. This allows a vendor that normally uses external wallet apps to issue mock credentials through the real OID4VCI channel and return offer details that the UI can turn into a QR code or deep-link for operator-driven demos and fixture validation.

## Architectural rule

- The local API resolves vendor behavior through the adapter registry.
- The frontend reads the vendor list from the API.
- The UI never imports vendor-specific payload contracts.
- The adapter boundary is responsible for bridging to external wallet applications when a vendor does not use in-app mock wallets.

This keeps personal-wallet requests and company-wallet requests as first-class adapter operations and allows additional vendors to be registered without changing the workflow screens.