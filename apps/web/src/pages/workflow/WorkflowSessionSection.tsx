import type { OrchestrationSession, VendorDefinition, VendorId } from '@we-build/domain';

import { PageSection } from '../../components/PageLayout.js';
import { getVendorDisplay, useI18n } from '../../i18n.js';
import { getStatusNotes, getWalletSeedOptions, getWorkflowStatusLabels } from '../../workflowUi.js';
import { formatTimestamp } from './WorkflowShared.js';
import { WalletCredentialCard } from './WorkflowShared.js';
import type { HealthState, SessionState, WorkflowPageProps } from './types.js';

type WorkflowSessionSectionProps = {
  apiBaseUrl: string;
  vendorOptions: VendorDefinition[];
  selectedVendor: VendorId;
  selectedVendorOption?: VendorDefinition;
  session: OrchestrationSession | null;
  sessionState: SessionState;
  health: HealthState;
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
  onVendorChange,
  onStartNewSession,
  canTriggerVendorActions = false,
  onTriggerAction,
  showReviewPayload = true,
  showWalletSetup = false,
  onSeedWalletCredential,
}: WorkflowSessionSectionProps) {
  const { locale, t } = useI18n();
  const statusNotes = getStatusNotes(locale);
  const walletSeedOptions = getWalletSeedOptions(locale);
  const workflowStatusLabels = getWorkflowStatusLabels(locale);
  const allowsWalletSeeding = Boolean(selectedVendorOption?.capabilities.mockWalletSeeding);
  const showsWalletState = Boolean(
    session?.wallets.personal.loadedCredentials.length
    || session?.wallets.company.loadedCredentials.length
    || selectedVendorOption?.id === 'mock-local',
  );
  const walletCredentials = [
    ...(session?.wallets.personal.loadedCredentials ?? []),
    ...(session?.wallets.company.loadedCredentials ?? []),
  ];
  const usesExternalWallets = selectedVendorOption?.walletInteraction.personal === 'external-wallet-app'
    || selectedVendorOption?.walletInteraction.company === 'external-wallet-app';
  const selectedVendorDisplay = selectedVendorOption ? getVendorDisplay(locale, selectedVendorOption.id) : undefined;
  const reviewPayload = session?.review.data;
  const issuanceResult = session?.vatIssuance.data;

  return (
    <PageSection
      id="workflow"
      eyebrow={t.sessionSection.eyebrow}
      title={t.sessionSection.title}
      copy={t.sessionSection.copy}
      stacked
    >
      <div className="service-grid">
        <section className="panel control-panel unified-workflow-panel">
          <div className="workflow-card-stack">
            <div className="workflow-card-main">
              <div className="panel-heading-inline">
                <strong>{t.sessionSection.vendorProfile}</strong>
                <span className="vendor-badge">{selectedVendorDisplay?.badge ?? t.common.loading}</span>
              </div>
              <label className="select-label" htmlFor="vendor-select">
                {t.sessionSection.vendorLabel}
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
                    {getVendorDisplay(locale, vendor.id).label}
                  </option>
                ))}
              </select>

              <p className="supporting-copy">{selectedVendorDisplay?.description ?? t.common.loadingVendorDefinitions}</p>
            </div>

            <section className="workflow-card-status" id="status">
              <p className="panel-label">{t.sessionSection.serviceStatus}</p>
              <div className="status-list">
                <div className="status-item">
                  <span>{t.sessionSection.frontend}</span>
                  <strong>{t.common.localShellActive}</strong>
                </div>
                <div className="status-item">
                  <span>{t.sessionSection.apiHealth}</span>
                  <strong data-state={health.status}>{health.detail}</strong>
                </div>
                <div className="status-item">
                  <span>{t.sessionSection.apiBaseUrl}</span>
                  <strong>{apiBaseUrl}</strong>
                </div>
                <div className="status-item">
                  <span>{t.sessionSection.sessionApi}</span>
                  <strong data-state={sessionState.status}>{sessionState.detail}</strong>
                </div>
                <div className="status-item">
                  <span>{t.sessionSection.sessionId}</span>
                  <strong>{session?.sessionId ?? t.common.notLoadedYet}</strong>
                </div>
              </div>

              <div className="action-row">
                <button type="button" className="action-button" onClick={onStartNewSession}>
                  {t.sessionSection.startNewSession}
                </button>
              </div>
            </section>

            {showWalletSetup && onSeedWalletCredential ? (
              <div className="workflow-inline-section">
                <p className="panel-label">{t.sessionSection.testCredentials}</p>
                <p className="supporting-copy">
                  {allowsWalletSeeding
                    ? usesExternalWallets
                      ? t.sessionSection.testCredentialCopy.externalWallets
                      : t.sessionSection.testCredentialCopy.localWallets
                    : t.sessionSection.testCredentialCopy.noWalletSeeding}
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

          {showWalletSetup && showsWalletState ? (
            <div className="wallet-grid">
              <section className="panel">
                <p className="panel-label">{t.sessionSection.walletCredentials}</p>
                <ul className="wallet-list">
                  {walletCredentials.length ? walletCredentials.map((credential) => (
                    <WalletCredentialCard key={`${credential.credentialType}-${credential.seededAt}`} credential={credential} />
                  )) : <li>{t.common.noCredentialsLoaded}</li>}
                </ul>
              </section>
            </div>
          ) : null}

          {showReviewPayload ? (
          <div className="card-grid" aria-label={t.sessionSection.reviewPayloadCardsAria}>
            <article className="step-card" data-state={session?.review.status ?? 'not-started'}>
              <div className="step-card-top">
                <h4>{t.sessionSection.reviewPayload}</h4>
                <span className="step-state">{workflowStatusLabels[session?.review.status ?? 'not-started']}</span>
              </div>
              <p className="step-summary">{t.sessionSection.reviewPayloadSummary}</p>
              <p className="step-note">{statusNotes[session?.review.status ?? 'not-started']}</p>

              {reviewPayload ? (
                <div className="review-sections">
                  <div className="review-block">
                    <h4>{t.review.person}</h4>
                    <dl className="review-list">
                      <div><dt>{t.fields.name}</dt><dd>{reviewPayload.person.fullName}</dd></div>
                      <div><dt>{t.fields.dateOfBirth}</dt><dd>{reviewPayload.person.dateOfBirth}</dd></div>
                      <div><dt>{t.fields.nationality}</dt><dd>{reviewPayload.person.nationality}</dd></div>
                    </dl>
                  </div>

                  <div className="review-block">
                    <h4>{t.review.company}</h4>
                    <dl className="review-list">
                      <div><dt>{t.fields.name}</dt><dd>{reviewPayload.company.companyName}</dd></div>
                      <div><dt>{t.fields.companyId}</dt><dd>{reviewPayload.company.companyId}</dd></div>
                      <div><dt>{t.fields.jurisdiction}</dt><dd>{reviewPayload.company.jurisdiction}</dd></div>
                    </dl>
                  </div>

                  <div className="review-block">
                    <h4>{t.review.poa}</h4>
                    <dl className="review-list">
                      <div><dt>{t.fields.principal}</dt><dd>{reviewPayload.poa.principalName}</dd></div>
                      <div><dt>{t.fields.attorney}</dt><dd>{reviewPayload.poa.attorneyName}</dd></div>
                      <div><dt>{t.fields.scope}</dt><dd>{reviewPayload.poa.scope.join(', ')}</dd></div>
                    </dl>
                  </div>

                  <div className="review-block">
                    <h4>{t.review.eucc}</h4>
                    <dl className="review-list">
                      <div><dt>{t.fields.legalForm}</dt><dd>{reviewPayload.eucc.legalForm}</dd></div>
                      <div><dt>{t.fields.registeredAddress}</dt><dd>{reviewPayload.eucc.registeredAddress}</dd></div>
                      <div><dt>{t.fields.representatives}</dt><dd>{reviewPayload.eucc.representativeNames.join(', ')}</dd></div>
                    </dl>
                  </div>

                  <div className="review-block">
                    <h4>{t.review.matchedVatAttestation}</h4>
                    <dl className="review-list">
                      <div><dt>{t.workflowStep.issuanceFields.vatId}</dt><dd>{reviewPayload.vatAttestation.vatId}</dd></div>
                      <div><dt>{t.fields.economicOperator}</dt><dd>{reviewPayload.vatAttestation.economicOperatorName}</dd></div>
                      <div><dt>{t.fields.operatorId}</dt><dd>{reviewPayload.vatAttestation.economicOperatorId}</dd></div>
                      <div><dt>{t.workflowStep.issuanceFields.administrativeUnit}</dt><dd>{reviewPayload.vatAttestation.administrativeUnitName}</dd></div>
                      <div><dt>{t.fields.issuer}</dt><dd>{reviewPayload.vatAttestation.issuingOrganisation}</dd></div>
                    </dl>
                    <p className="supporting-copy">{t.review.matchedHint}</p>
                  </div>

                  <p className="supporting-copy">{t.review.assembledAt} {formatTimestamp(reviewPayload.assembledAt, locale, t.common.notAvailable)}.</p>
                </div>
              ) : (
                <p className="supporting-copy">
                  {t.sessionSection.reviewPayloadEmpty}
                </p>
              )}

              <div className="step-meta">
                <span>{t.sessionSection.operatorStep}</span>
              </div>

              <div className="action-row">
                <button
                  type="button"
                  className="action-button"
                  onClick={() => onTriggerAction?.('vatIssuance')}
                  disabled={!onTriggerAction || !canTriggerVendorActions || session?.review.status !== 'succeeded'}
                >
                  {t.workflowStep.submitVatIssuance}
                </button>
                <button
                  type="button"
                  className="action-button action-button-secondary"
                  onClick={() => onTriggerAction?.('issuanceStatus')}
                  disabled={!onTriggerAction || !canTriggerVendorActions || session?.vatIssuance.status !== 'pending'}
                >
                  {t.sessionSection.refreshIssuanceStatus}
                </button>
              </div>
            </article>

            <article className="step-card" data-state={session?.vatIssuance.status ?? 'not-started'}>
              <div className="step-card-top">
                <h4>{t.sessionSection.issuanceResult}</h4>
                <span className="step-state">{workflowStatusLabels[session?.vatIssuance.status ?? 'not-started']}</span>
              </div>
              <p className="step-summary">
                {t.sessionSection.issuanceResultSummary}
              </p>
              <p className="step-note">{statusNotes[session?.vatIssuance.status ?? 'not-started']}</p>

              {issuanceResult ? (
                <dl className="review-list">
                  <div><dt>{t.workflowStep.issuanceFields.vatId}</dt><dd>{issuanceResult.vatId}</dd></div>
                  <div><dt>{t.workflowStep.issuanceFields.organisation}</dt><dd>{issuanceResult.issuingOrganisation}</dd></div>
                  <div><dt>{t.workflowStep.issuanceFields.country}</dt><dd>{issuanceResult.issuingCountry}</dd></div>
                  <div><dt>{t.workflowStep.issuanceFields.administrativeUnit}</dt><dd>{issuanceResult.administrativeUnitName}</dd></div>
                  <div><dt>{t.workflowStep.issuanceFields.status}</dt><dd>{workflowStatusLabels[session?.vatIssuance.status ?? 'not-started']}</dd></div>
                  <div><dt>{t.workflowStep.issuanceFields.issuedAt}</dt><dd>{formatTimestamp(issuanceResult.issuedAt, locale, t.common.notAvailable)}</dd></div>
                  <div><dt>{t.workflowStep.issuanceFields.exchangeId}</dt><dd>{issuanceResult.exchangeId ?? t.common.notAssignedYet}</dd></div>
                </dl>
              ) : (
                <p className="supporting-copy">
                  {t.sessionSection.issuanceResultEmpty}
                </p>
              )}

              <div className="step-meta">
                <span>{t.sessionSection.submissionResult}</span>
              </div>
            </article>
          </div>
          ) : null}
        </section>
      </div>

      <div className="message-box" id="session-overview">
        <strong>{t.sessionSection.sessionOverview}</strong>
        <p>
          {t.sessionSection.sessionOverviewCopy1}
        </p>
        <p>
          {t.sessionSection.sessionOverviewCopy2}
        </p>
      </div>
    </PageSection>
  );
}