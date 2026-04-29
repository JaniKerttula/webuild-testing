import type { OrchestrationSession, VendorDefinition, VendorId } from '@we-build/domain';

import { PageSection } from '../../components/PageLayout.js';
import { statusNotes, walletSeedOptions } from '../../workflowUi.js';
import { formatTimestamp } from './WorkflowShared.js';
import { WalletCredentialCard, WorkflowQrPanel } from './WorkflowShared.js';
import type { HealthState, SessionState, WorkflowPageProps } from './types.js';

type WorkflowSessionSectionProps = {
  apiBaseUrl: string;
  vendorOptions: VendorDefinition[];
  selectedVendor: VendorId;
  selectedVendorOption?: VendorDefinition;
  session: OrchestrationSession | null;
  sessionState: SessionState;
  health: HealthState;
  stepCount: number;
  onVendorChange: (vendorId: VendorId) => void;
  onStartNewSession: () => void;
  canTriggerVendorActions?: boolean;
  onTriggerAction?: WorkflowPageProps['onTriggerAction'];
  showReviewPayload?: boolean;
  showWalletSetup?: boolean;
  onSeedWalletCredential?: WorkflowPageProps['onSeedWalletCredential'];
};

export function WorkflowSessionSection({
  apiBaseUrl,
  vendorOptions,
  selectedVendor,
  selectedVendorOption,
  session,
  sessionState,
  health,
  stepCount,
  onVendorChange,
  onStartNewSession,
  canTriggerVendorActions = false,
  onTriggerAction,
  showReviewPayload = true,
  showWalletSetup = false,
  onSeedWalletCredential,
}: WorkflowSessionSectionProps) {
  const allowsWalletSeeding = Boolean(selectedVendorOption?.capabilities.mockWalletSeeding);
  const showsWalletState = selectedVendorOption?.id === 'mock-local';
  const usesExternalWallets = selectedVendorOption?.walletInteraction.personal === 'external-wallet-app'
    || selectedVendorOption?.walletInteraction.company === 'external-wallet-app';
  const personalPidOffer = session?.wallets.personal.loadedCredentials.find(
    (credential) => credential.credentialType === 'pid' && credential.offer,
  );
  const reviewPayload = session?.review.data;
  const issuanceResult = session?.vatIssuance.data;

  return (
    <PageSection
      id="workflow"
      eyebrow="Create workflow"
      title="Prepare local workflow session"
      copy="Select the local vendor profile and review the available session state before the step-by-step flow is connected to live actions."
      stacked
    >
      <div className="service-grid">
        <section className="panel control-panel unified-workflow-panel">
          <div className="workflow-card-stack">
            <div className="workflow-card-main">
              <div className="panel-heading-inline">
                <strong>Vendor profile</strong>
                <span className="vendor-badge">{selectedVendorOption?.badge ?? 'Loading'}</span>
              </div>
              <label className="select-label" htmlFor="vendor-select">
                Vendor
              </label>
              <select
                id="vendor-select"
                className="vendor-select"
                value={selectedVendor}
                onChange={(event) => onVendorChange(event.target.value as VendorId)}
                disabled={!vendorOptions.length}
              >
                {vendorOptions.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.label}
                  </option>
                ))}
              </select>

              <p className="supporting-copy">{selectedVendorOption?.description ?? 'Loading vendor definitions from the local API.'}</p>
            </div>

            <section className="workflow-card-status" id="status">
              <p className="panel-label">Service status</p>
              <div className="status-list">
                <div className="status-item">
                  <span>Frontend</span>
                  <strong>Local shell active</strong>
                </div>
                <div className="status-item">
                  <span>API health</span>
                  <strong data-state={health.status}>{health.detail}</strong>
                </div>
                <div className="status-item">
                  <span>API base URL</span>
                  <strong>{apiBaseUrl}</strong>
                </div>
                <div className="status-item">
                  <span>Session API</span>
                  <strong data-state={sessionState.status}>{sessionState.detail}</strong>
                </div>
                <div className="status-item">
                  <span>Session id</span>
                  <strong>{session?.sessionId ?? 'Not loaded yet'}</strong>
                </div>
              </div>

              <div className="action-row">
                <button type="button" className="action-button" onClick={onStartNewSession}>
                  Start new session
                </button>
              </div>
            </section>

            {showWalletSetup && onSeedWalletCredential ? (
              <div className="workflow-inline-section">
                <p className="panel-label">Test credentials</p>
                <p className="supporting-copy">
                  {allowsWalletSeeding
                    ? usesExternalWallets
                      ? 'This vendor creates real wallet offers for seeded test credentials. Use the QR code below when the PID issuer connection appears.'
                      : 'This vendor supports local mock credential seeding, so wallets can be preloaded before running vendor-backed steps.'
                    : 'This vendor does not expose local mock credential seeding. Credential state must come back through vendor adapter actions.'}
                </p>
                <div className="step-actions">
                  {walletSeedOptions.map((option) => (
                    <button
                      key={`${option.walletRole}-${option.credentialType}`}
                      type="button"
                      className="action-button"
                      onClick={() => onSeedWalletCredential(option.walletRole, option.credentialType)}
                      disabled={!session || !allowsWalletSeeding}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {showWalletSetup && personalPidOffer?.offer ? (
            <WorkflowQrPanel
              title="PID issuer connection"
              badge="OID4VCI"
              description="Use this QR code or deep-link to open the wallet and accept the PID credential offer from the issuer."
              qrValue={personalPidOffer.offer.qrCodeValue}
              qrAlt="PID issuer connection QR code"
              metadata={[
                { label: 'Credential', value: personalPidOffer.label },
                { label: 'Holder', value: personalPidOffer.holderName },
                { label: 'Exchange ID', value: personalPidOffer.offer.exchangeId ?? 'Pending' },
                { label: 'PIN', value: personalPidOffer.offer.userPin ?? 'Not required' },
              ]}
              primaryAction={{ href: personalPidOffer.offer.offerUri, label: 'Open issuer deep-link' }}
              secondaryAction={personalPidOffer.offer.referenceUri
                ? { href: personalPidOffer.offer.referenceUri, label: 'Open raw offer URL' }
                : undefined}
            />
          ) : null}

          {showWalletSetup && showsWalletState ? (
            <div className="wallet-grid unified-wallet-grid">
              <section className="panel">
                <p className="panel-label">Personal wallet</p>
                <ul className="wallet-list">
                  {session?.wallets.personal.loadedCredentials.length ? session.wallets.personal.loadedCredentials.map((credential) => (
                    <WalletCredentialCard key={`personal-${credential.credentialType}`} credential={credential} />
                  )) : <li>No credentials loaded.</li>}
                </ul>
              </section>

              <section className="panel">
                <p className="panel-label">Company wallet</p>
                <ul className="wallet-list">
                  {session?.wallets.company.loadedCredentials.length ? session.wallets.company.loadedCredentials.map((credential) => (
                    <WalletCredentialCard key={`company-${credential.credentialType}`} credential={credential} />
                  )) : <li>No credentials loaded.</li>}
                </ul>
              </section>
            </div>
          ) : null}

          {showReviewPayload ? (
          <div className="card-grid" aria-label="Review payload cards">
            <article className="step-card" data-state={session?.review.status ?? 'not-started'}>
              <div className="step-card-top">
                <h4>Review payload</h4>
                <span className="step-state">{session?.review.status ?? 'not-started'}</span>
              </div>
              <p className="step-summary">Assemble PID, company, PoA, and EUCC into one review object.</p>
              <p className="step-note">{statusNotes[session?.review.status ?? 'not-started']}</p>

              {reviewPayload ? (
                <div className="review-sections">
                  <div className="review-block">
                    <h4>Person</h4>
                    <dl className="review-list">
                      <div><dt>Name</dt><dd>{reviewPayload.person.fullName}</dd></div>
                      <div><dt>Date of birth</dt><dd>{reviewPayload.person.dateOfBirth}</dd></div>
                      <div><dt>Nationality</dt><dd>{reviewPayload.person.nationality}</dd></div>
                    </dl>
                  </div>

                  <div className="review-block">
                    <h4>Company</h4>
                    <dl className="review-list">
                      <div><dt>Name</dt><dd>{reviewPayload.company.companyName}</dd></div>
                      <div><dt>Company ID</dt><dd>{reviewPayload.company.companyId}</dd></div>
                      <div><dt>Jurisdiction</dt><dd>{reviewPayload.company.jurisdiction}</dd></div>
                    </dl>
                  </div>

                  <div className="review-block">
                    <h4>PoA</h4>
                    <dl className="review-list">
                      <div><dt>Principal</dt><dd>{reviewPayload.poa.principalName}</dd></div>
                      <div><dt>Attorney</dt><dd>{reviewPayload.poa.attorneyName}</dd></div>
                      <div><dt>Scope</dt><dd>{reviewPayload.poa.scope.join(', ')}</dd></div>
                    </dl>
                  </div>

                  <div className="review-block">
                    <h4>EUCC</h4>
                    <dl className="review-list">
                      <div><dt>Legal form</dt><dd>{reviewPayload.eucc.legalForm}</dd></div>
                      <div><dt>Registered address</dt><dd>{reviewPayload.eucc.registeredAddress}</dd></div>
                      <div><dt>Representatives</dt><dd>{reviewPayload.eucc.representativeNames.join(', ')}</dd></div>
                    </dl>
                  </div>

                  <div className="review-block">
                    <h4>Matched VAT attestation</h4>
                    <dl className="review-list">
                      <div><dt>VAT ID</dt><dd>{reviewPayload.vatAttestation.vatId}</dd></div>
                      <div><dt>Economic operator</dt><dd>{reviewPayload.vatAttestation.economicOperatorName}</dd></div>
                      <div><dt>Operator ID</dt><dd>{reviewPayload.vatAttestation.economicOperatorId}</dd></div>
                      <div><dt>Administrative unit</dt><dd>{reviewPayload.vatAttestation.administrativeUnitName}</dd></div>
                      <div><dt>Issuer</dt><dd>{reviewPayload.vatAttestation.issuingOrganisation}</dd></div>
                    </dl>
                    <p className="supporting-copy">Matched from the verified EUCC company before issuance.</p>
                  </div>

                  <p className="supporting-copy">Assembled at {formatTimestamp(reviewPayload.assembledAt)}.</p>
                </div>
              ) : (
                <p className="supporting-copy">
                  The review payload appears automatically after PID, PoA, and EUCC succeed. This card becomes the explicit submission surface for VAT issuance.
                </p>
              )}

              <div className="step-meta">
                <span>Operator step</span>
              </div>

              <div className="action-row">
                <button
                  type="button"
                  className="action-button"
                  onClick={() => onTriggerAction?.('vatIssuance')}
                  disabled={!onTriggerAction || !canTriggerVendorActions || session?.review.status !== 'succeeded'}
                >
                  Submit VAT issuance
                </button>
                <button
                  type="button"
                  className="action-button action-button-secondary"
                  onClick={() => onTriggerAction?.('issuanceStatus')}
                  disabled={!onTriggerAction || !canTriggerVendorActions || session?.vatIssuance.status !== 'pending'}
                >
                  Refresh issuance status
                </button>
              </div>
            </article>

            <article className="step-card" data-state={session?.vatIssuance.status ?? 'not-started'}>
              <div className="step-card-top">
                <h4>Issuance result</h4>
                <span className="step-state">{session?.vatIssuance.status ?? 'not-started'}</span>
              </div>
              <p className="step-summary">
                VAT issuance output appears here after submission. Pending vendor modes can remain in progress until a later status refresh.
              </p>
              <p className="step-note">{statusNotes[session?.vatIssuance.status ?? 'not-started']}</p>

              {issuanceResult ? (
                <dl className="review-list">
                  <div><dt>VAT ID</dt><dd>{issuanceResult.vatId}</dd></div>
                  <div><dt>Organisation</dt><dd>{issuanceResult.issuingOrganisation}</dd></div>
                  <div><dt>Country</dt><dd>{issuanceResult.issuingCountry}</dd></div>
                  <div><dt>Administrative unit</dt><dd>{issuanceResult.administrativeUnitName}</dd></div>
                  <div><dt>Status</dt><dd>{issuanceResult.status}</dd></div>
                  <div><dt>Issued at</dt><dd>{formatTimestamp(issuanceResult.issuedAt)}</dd></div>
                  <div><dt>Exchange ID</dt><dd>{issuanceResult.exchangeId ?? 'Not assigned yet'}</dd></div>
                </dl>
              ) : (
                <p className="supporting-copy">
                  VAT issuance output appears here after the explicit submit action. Pending vendor modes can stay in progress until a later status refresh.
                </p>
              )}

              <div className="step-meta">
                <span>Submission result</span>
              </div>
            </article>
          </div>
          ) : null}
        </section>
      </div>

      <div className="message-box" id="session-overview">
        <strong>Session overview</strong>
        <p>
          The landing page now keeps vendor selection, service status, and test credential setup in
          one place, with the active session id visible directly in the status block.
        </p>
        <p>
          The mock local vendor now runs directly from the page with success and failure
          simulation modes for every step.
        </p>
      </div>
    </PageSection>
  );
}