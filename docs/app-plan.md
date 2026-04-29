# Application Plan

## Purpose

This document breaks the application into small, operator-verifiable steps.
The target product is a React application that supports multiple issuance and verification vendors, starts locally on localhost, and later moves to Azure.

The primary user flow is:

1. Select vendor.
2. Identify the user with a mock PID from a personal wallet.
3. Show an action to initiate VAT attestation issuance on behalf of a company.
4. Request a mock PoA from the personal wallet.
5. Request a mock EUCC attestation from the company wallet.
6. Show the collected mock data on the screen for review.
7. Submit the collected data.
8. Start mock VAT attestation issuance to the company wallet.
9. Track the result and show the final state.

## Planning Principles

- Start with localhost-only implementation.
- Keep each step small enough to review and accept independently.
- Keep the first implementation fully mock.
- Keep vendor-specific logic out of the UI.
- Use mock PID, mock PoA, mock EUCC, and mock VAT issuance data for the first demo flow.
- Treat local mock wallets and external real wallet apps as separate testing modes.
- Add Azure only after the local workflow is proven.

## Initial Architecture

The first implementation should still include a small local backend even though the product is frontend-led.

- Frontend: React and TypeScript single-page application.
- Local API: small backend-for-frontend for secrets, orchestration, and vendor calls.
- Storage: use memory-only persistence for the first implementation.
- Vendor model: one mock adapter first, with interfaces ready for future vendor-specific adapters.
- Wallet roles: one personal wallet role and one company wallet role in the demo flow.
- Local demo credential model: PID, PoA, EUCC, and VAT attestation are mock objects managed by the app for localhost testing only.
- Vendor testing model: when testing a real vendor such as iGrant.io, credentials are issued to and requested from real external wallet applications outside this app.
- Mock data source: read the demo payloads from the repository fixture files under [mock-data](../mock-data).

This is the minimum shape that supports a self-contained mock workflow, two wallet roles, review-before-submit behavior, and a safe move to Azure later.

## Step-by-Step Delivery Plan

### Step 1: Create the local project skeleton

Goal:
Create a runnable local workspace with a frontend app and a small local API.

Implementation:

- Create a React and TypeScript frontend project.
- Create a local API project in the same repository.
- Add shared configuration for local ports and environment variables.
- Add scripts to start the frontend and API together.

Operator verification:

- Start the app locally.
- Open the frontend in the browser.
- Call a health endpoint on the local API.
- Confirm both services can be started and stopped cleanly.

Exit criteria:

- Frontend loads on localhost.
- API responds on localhost.
- One command or one documented sequence starts both services.

### Step 2: Build the application shell and layout

Goal:
Create the visual shell based on the style direction from wallet.minisuomi.fi without adding business logic yet.

Implementation:

- Add the landing layout, header, footer, and main workspace structure.
- Create the main step cards for PID, company initiation, PoA, EUCC, review, and VAT issuance.
- Add the vendor dropdown to the layout.
- Use placeholder content and static states first.

Operator verification:

- Open the UI on desktop and mobile widths.
- Confirm the layout is readable and step order is clear.
- Confirm the vendor dropdown is visible and changes UI state.

Exit criteria:

- The application has a coherent landing view and workflow view.
- The step cards and vendor selector are present.
- Styling direction is stable enough to keep building on.

### Step 3: Define the internal domain model

Goal:
Create a vendor-neutral application model for the workflow.

Implementation:

- Define TypeScript models for vendor selection, orchestration session, PID data, PoA data, EUCC data, review payload, and VAT issuance result.
- Define the workflow states for the end-to-end process.
- Define a normalized error structure.

Operator verification:

- Review the models and state transitions.
- Confirm that no vendor-specific payload types are exposed to the UI.
- Confirm that success, pending, and failure states exist for PID, PoA, EUCC, review, and VAT issuance.

Exit criteria:

- The app has one documented and implemented internal state model.
- Frontend components can render from normalized state only.

### Step 4: Add a local session API

Goal:
Create the local orchestration API that owns the workflow session.

Implementation:

- Add endpoints to create a session, read a session, and update step state.
- Store session state in memory only.
- Return a session identifier to the frontend.

Operator verification:

- Start a new session from the UI or API client.
- Refresh the browser and reload the session.
- Confirm the current workflow state is returned by the API.

Exit criteria:

- The backend owns the canonical session state.
- The frontend can fetch and render the session state.

### Step 5: Define the vendor adapter contract

Goal:
Create a stable contract for vendor operations before implementing real integrations.

Implementation:

- Define adapter methods for requesting a mock PID from a personal wallet.
- Define adapter methods for initiating VAT issuance on behalf of a company.
- Define adapter methods for requesting a mock PoA from a personal wallet.
- Define adapter methods for requesting a mock EUCC attestation from a company wallet.
- Define adapter methods for assembling review data and submitting mock VAT issuance.
- Define adapter methods for reading issuance status.
- Ensure the contract can support both local mock wallets and external wallet applications.
- Add capability flags so the UI can react to vendor support later.

Operator verification:

- Review the adapter interface.
- Confirm the UI and session API only depend on the interface, not on any vendor-specific payloads.
- Confirm the interface supports personal-wallet and company-wallet requests as first-class operations.
- Confirm the interface does not assume wallets are embedded in this app for every vendor.
- Confirm a second vendor could be added without changing the workflow screens.

Exit criteria:

- One adapter contract exists and is used by the local API.
- The contract covers mock PID retrieval, company initiation, PoA retrieval, EUCC retrieval, review assembly, and VAT issuance responsibilities.

### Step 6: Add a mock local vendor

Goal:
Prove the end-to-end UI and state machine with a self-contained mock flow.

Implementation:

- Implement a local mock adapter.
- Load PID, PoA, EUCC, and VAT payloads from the repository mock-data fixtures.
- Simulate PID retrieval success and failure from the personal wallet.
- Simulate company selection and issuance initiation.
- Simulate PoA retrieval success and failure from the personal wallet.
- Simulate EUCC retrieval success and failure from the company wallet.
- Simulate review payload generation.
- Simulate VAT issuance start, pending state, and completion to the company wallet.

Operator verification:

- Run the full flow locally with the mock vendor.
- Retry failed steps.
- Confirm the state machine behaves correctly across success and failure paths.

Exit criteria:

- The whole application flow works locally with predictable test data.
- Failures and retries are visible and understandable.

### Step 7: Issue mock credentials to the test wallets

Goal:
Preload the personal wallet and company wallet with the mock credentials needed for local mock testing.

Implementation:

- Add a separate local test setup action for issuing the mock PID to the personal wallet.
- Add a separate local test setup action for issuing the mock PoA to the personal wallet.
- Add a separate local test setup action for issuing the mock EUCC attestation to the company wallet.
- Keep the issued test credentials aligned with the fixture files in [mock-data](mock-data).
- Show which credentials are currently loaded into each wallet before the main flow starts.
- Keep this wallet setup path scoped to the local mock vendor only.
- For vendor testing with real wallets, use the vendor adapter to issue test credentials to external wallet apps and request them back from those apps.

Operator verification:

- Run each wallet setup action independently.
- Confirm the personal wallet contains the mock PID and mock PoA.
- Confirm the company wallet contains the mock EUCC attestation.
- Confirm the main flow can start from the preloaded wallet state.
- Confirm the local mock wallet setup is not treated as the source of truth for vendor modes that use external wallets.

Exit criteria:

- Both demo wallets can be seeded locally with the required mock credentials.
- The operator can repeat the flow without manually editing test data.

### Step 8: Implement mock PID identification flow

Goal:
Replace the placeholder PID step with a working mock personal-wallet identification flow.

Implementation:

- Add a mock PID request action in the UI.
- Return mock identity data from [mock-data/pid-credential.mock.json](mock-data/pid-credential.mock.json).
- Store the normalized PID result in the session.
- Gate company initiation until PID is present.

Operator verification:

- Start the PID step from the UI.
- Confirm mock personal identity data is returned and shown.
- Confirm the next action becomes available only after PID succeeds.

Exit criteria:

- The app can complete the mock PID step and persist the result in the session.
- For external wallet vendors, the same normalized PID result must come from the external wallet request path instead of local in-app wallet state.

### Step 9: Implement company initiation flow

Goal:
Let the operator initiate VAT attestation issuance on behalf of a company after PID has been collected.

Implementation:

- Add a company selection and initiation action.
- Store the chosen company context in the session.
- Gate PoA and EUCC collection until the company initiation step is complete.

Operator verification:

- Complete the PID step.
- Click the button to initiate VAT attestation issuance on behalf of a company.
- Confirm the chosen company is visible in the session state.

Exit criteria:

- The app blocks PoA and EUCC collection until company initiation is completed.

### Step 10: Implement mock PoA collection from the personal wallet

Goal:
Replace the placeholder PoA step with a working mock personal-wallet request.

Implementation:

- Add a mock PoA request action in the UI.
- Return mock representation data from [mock-data/poa-attestation-credential.mock.json](mock-data/poa-attestation-credential.mock.json).
- Associate the PoA result with the selected company and identified person.

Operator verification:

- Start the PoA step after company initiation.
- Confirm the collected PoA data is visible in the UI.
- Confirm review or submit actions remain disabled until EUCC is also collected.

Exit criteria:

- The app can complete the mock PoA step and persist the result in the session.

### Step 11: Implement mock EUCC collection from the company wallet

Goal:
Replace the placeholder EUCC step with a working mock company-wallet request.

Implementation:

- Add a mock EUCC request action in the UI.
- Return mock company-wallet attestation data from [mock-data/eucc-attestation-credential.mock.json](mock-data/eucc-attestation-credential.mock.json).
- Associate the EUCC result with the selected company context.

Operator verification:

- Start the EUCC step after company initiation.
- Confirm the collected EUCC data is visible in the UI.
- Confirm the review action becomes available only after both PoA and EUCC are collected.

Exit criteria:

- The app can complete the mock EUCC step and persist the result in the session.

### Step 12: Implement review and submit flow

Goal:
Show the assembled data before starting VAT issuance and require an explicit submit action.

Implementation:

- Build a review screen that shows PID data, selected company data, PoA data, and EUCC data together.
- Add a submit action that starts mock VAT issuance to the company wallet using [mock-data/vat-attestation-credential.mock.json](mock-data/vat-attestation-credential.mock.json).
- Add clear status text and action buttons for each state.
- Add a simple history or event log panel.

Operator verification:

- Complete PID, company initiation, PoA, and EUCC collection.
- Confirm the collected data is shown before submission.
- Submit and confirm VAT issuance only starts after the explicit review step.

Exit criteria:

- One operator can review the collected data before starting issuance.

### Step 13: Complete the full localhost journey

Goal:
Prove the product flow from PID through mock VAT issuance to the company wallet.

Implementation:

- Connect PID, company initiation, PoA, EUCC, review, submit, and issuance status into one session workflow.
- Make the screen clearly distinguish the personal wallet data from the company wallet data.
- Show that all values are mock data in the UI.

Operator verification:

- Run the full flow end to end on localhost.
- Refresh during the process and confirm the session resumes.
- Confirm the final state is visible and understandable.

Exit criteria:

- One operator can execute the full mock flow locally.
- The UI clearly shows what happened at each step.

### Step 14: Harden the local implementation

Goal:
Make the localhost version stable enough for repeated operator testing.

Implementation:

- Add structured logging.
- Add form validation and input guards.
- Add timeout and retry handling for vendor calls.
- Add automated tests for the session state machine and adapter normalization.

Operator verification:

- Force known error cases.
- Confirm retry behavior is visible and safe.
- Run the automated tests.

Exit criteria:

- Known failure cases are handled without breaking the session.
- Core tests pass locally.

### Step 15: Prepare Azure deployment shape

Goal:
Convert the proven localhost design into an Azure-ready deployment plan without changing the product behavior.

Implementation:

- Move local configuration to environment-based configuration.
- Replace local secret handling with Azure Key Vault design.
- Map the frontend deployment target to Azure App Service.
- Map the local API deployment target to Azure Functions.
- Define Application Insights correlation for session id and exchange id.
- Keep the first deployed version on memory-only persistence and accept non-durable sessions as a demo constraint.

Operator verification:

- Review the deployment mapping from local services to Azure services.
- Confirm no browser-exposed secret is required.
- Confirm the frontend packaging is suitable for App Service deployment.
- Confirm the API shape is suitable for Azure Functions deployment.
- Confirm the runtime configuration can be changed per environment.

Exit criteria:

- The local architecture maps directly to Azure.
- No redesign is needed to deploy the proven workflow.
- The demo accepts session loss on restart because persistence remains memory-only.

## Suggested Local Technical Scope

For the first implementation, keep the scope narrow.

- One frontend application.
- One local API.
- One visible vendor option backed by a mock adapter.
- One mock adapter for development and testing.
- One local wallet-seeding step for test credentials.
- One mock PID collection flow.
- One mock PoA collection flow.
- One mock EUCC collection flow.
- One mock VAT issuance flow to the company wallet.

Do not add these in the first local version:

- Multi-tenant administration.
- Generic credential management screens.
- Additional vendors.
- Azure infrastructure automation.
- Production-grade persistence.
- External live verifier integrations.
- Real vendor-backed issuance or verification.

## Recommended Order of Verification

Verify in this order as operator:

1. Frontend and API start locally.
2. Static UI shell matches the intended workflow.
3. Session state is owned by the API.
4. Mock vendor can run the full flow.
5. Test wallets can be seeded with the mock credentials.
6. Mock PID collection works.
7. Company initiation works.
8. Mock PoA and mock EUCC collection work.
9. Review and submit work.
10. The full localhost journey works end to end.
11. Azure deployment mapping is clear.

## Repository References

- [docs/igrant-product-api-plan.md](docs/igrant-product-api-plan.md)
- [schemas/poa-attestation-credential.schema.json](schemas/poa-attestation-credential.schema.json)
- [schemas/eucc-attestation-credential.schema.json](schemas/eucc-attestation-credential.schema.json)
- [schemas/vat-attestation-credential.schema.json](schemas/vat-attestation-credential.schema.json)
- [mock-data/pid-credential.mock.json](mock-data/pid-credential.mock.json)
- [mock-data/poa-attestation-credential.mock.json](mock-data/poa-attestation-credential.mock.json)
- [mock-data/eucc-attestation-credential.mock.json](mock-data/eucc-attestation-credential.mock.json)
- [mock-data/vat-attestation-credential.mock.json](mock-data/vat-attestation-credential.mock.json)

## Open Decisions To Resolve Before Implementation Starts

- How the company wallet is represented in the demo UI: separate screen, separate modal, or simulated action within one operator view.

## Fixed Decisions

- Persistence is memory-only for the first implementation and first Azure-hosted demo.
- The frontend deployment target is Azure App Service.
- The local API deployment target is Azure Functions.
- All data is mock in the first implementation.
- The initial mock claim sets are defined in the repository fixture files under [mock-data](../mock-data).
- The test flow includes issuing the mock credentials to the demo wallets before exercising the main orchestration journey.
- Wallet seeding is done through separate per-credential actions, not one bulk setup action.