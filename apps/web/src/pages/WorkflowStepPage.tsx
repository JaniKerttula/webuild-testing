import {
  getWorkflowStepSnapshots,
  workflowStatusLabels,
  type EuccRecord,
  type PidRecord,
  type PoaRecord,
  type WalletPresentationRequest,
  type WorkflowStepKey,
} from '@we-build/domain';

import { PageHero, PageSection } from '../components/PageLayout.js';
import { actionLabels, statusNotes } from '../workflowUi.js';
import { WorkflowEvidenceSection } from './workflow/WorkflowEvidenceSection.js';
import { WorkflowHistorySection } from './workflow/WorkflowHistorySection.js';
import { WorkflowReviewSection } from './workflow/WorkflowReviewSection.js';
import { WorkflowQrEvidenceCard } from './workflow/WorkflowShared.js';
import type { JourneyNavigationItem, JourneyPageId, WorkflowPageProps } from './workflow/types.js';

type WorkflowStepPageProps = WorkflowPageProps & {
  stepKey: WorkflowStepKey;
  stepLabel: string;
  stepDescription: string;
  stepNumber: number;
  stepCount: number;
  stepPages: JourneyNavigationItem[];
  onNavigate: (pageId: JourneyPageId) => void;
  previousPageId?: JourneyPageId;
  nextPageId?: JourneyPageId;
};

export function WorkflowStepPage({
  selectedVendorOption,
  session,
  sessionState,
  health,
  stepKey,
  stepLabel,
  stepDescription,
  stepNumber,
  stepCount,
  stepPages,
  onNavigate,
  previousPageId,
  nextPageId,
  onTriggerAction,
  onResetStep,
  onRestartStep,
}: WorkflowStepPageProps) {
  const isMockLocalVendor = selectedVendorOption?.id === 'mock-local';
  const allowsExternalActions = selectedVendorOption?.walletInteraction.personal === 'external-wallet-app'
    || selectedVendorOption?.walletInteraction.company === 'external-wallet-app';
  const canTriggerVendorActions = Boolean(session) && (isMockLocalVendor || allowsExternalActions);
  const currentStep = session ? getWorkflowStepSnapshots(session).find((step) => step.key === stepKey) : undefined;
  const isReviewStep = stepKey === 'review' || stepKey === 'vatIssuance';
  const isEvidenceStep = stepKey === 'pid' || stepKey === 'poa' || stepKey === 'eucc';
  const isSucceededEvidenceStep = isEvidenceStep && currentStep?.status === 'succeeded';
  const primaryActionLabel = isEvidenceStep && currentStep?.status === 'pending' ? 'Retry' : actionLabels[stepKey];
  const currentRequest: WalletPresentationRequest | undefined = stepKey === 'pid'
    ? session?.pid.data?.request
    : stepKey === 'poa'
      ? session?.poa.data?.request
      : stepKey === 'eucc'
        ? session?.eucc.data?.request
        : undefined;
  const currentError = stepKey === 'pid'
    ? session?.pid.error?.message
    : stepKey === 'poa'
      ? session?.poa.error?.message
      : stepKey === 'eucc'
        ? session?.eucc.error?.message
        : undefined;
  const stepRecordView = stepKey === 'pid'
    ? (() => {
        const pidRecord: PidRecord | undefined = session?.pid.data?.record;

        return pidRecord ? (
          <dl className="review-list compact-review-list">
            <div><dt>Full name</dt><dd>{pidRecord.fullName}</dd></div>
            <div><dt>Date of birth</dt><dd>{pidRecord.dateOfBirth}</dd></div>
            <div><dt>Issuer</dt><dd>{pidRecord.issuerName}</dd></div>
          </dl>
        ) : null;
      })()
    : stepKey === 'poa'
      ? (() => {
          const poaRecord: PoaRecord | undefined = session?.poa.data?.record;

          return poaRecord ? (
            <dl className="review-list compact-review-list">
              <div><dt>Attorney</dt><dd>{poaRecord.attorneyName}</dd></div>
              <div><dt>Principal</dt><dd>{poaRecord.principalName}</dd></div>
              <div><dt>Scope</dt><dd>{poaRecord.scope.join(', ')}</dd></div>
            </dl>
          ) : null;
        })()
      : stepKey === 'eucc'
        ? (() => {
            const euccRecord: EuccRecord | undefined = session?.eucc.data?.record;

            return euccRecord ? (
              <dl className="review-list compact-review-list">
                <div><dt>Company</dt><dd>{euccRecord.companyName}</dd></div>
                <div><dt>Legal form</dt><dd>{euccRecord.legalForm}</dd></div>
                <div><dt>Member state</dt><dd>{euccRecord.registrationMemberState}</dd></div>
              </dl>
            ) : null;
          })()
        : null;
  const requestHeading = stepKey === 'pid'
    ? 'PID presentation request'
    : stepKey === 'poa'
      ? 'PoA presentation request'
      : 'EUCC presentation request';
  const requestDescription = stepKey === 'pid'
    ? 'Scan the QR code with the wallet to open the iGrant verification request and start transferring PID data back to the verifier.'
    : stepKey === 'poa'
      ? 'Scan the QR code with the wallet to open the iGrant verification request and start transferring PoA data back to the verifier.'
      : 'Scan the QR code with the company wallet to open the iGrant verification request and start transferring EUCC data back to the verifier.';
  const requestQrAlt = stepKey === 'pid'
    ? 'PID presentation request QR code'
    : stepKey === 'poa'
      ? 'PoA presentation request QR code'
      : 'EUCC presentation request QR code';
  const cancelMessage = stepKey === 'pid'
    ? 'PID request canceled.'
    : stepKey === 'poa'
      ? 'PoA request canceled.'
      : 'EUCC request canceled.';
  const reRequestLabel = stepKey === 'pid'
    ? 'Re-request PID'
    : stepKey === 'poa'
      ? 'Re-request PoA'
      : 'Re-request EUCC';
  const breadcrumbItems = stepPages.map((page) => ({
    id: page.id,
    label: page.label,
    isCurrent: page.stepKey === stepKey,
  }));

  return (
    <>
      <PageHero
        eyebrow={(
          <span className="workflow-breadcrumbs" aria-label="Workflow breadcrumb trail">
            {breadcrumbItems.map((item, index) => (
              <span
                key={item.id}
                className={`workflow-breadcrumb${item.isCurrent ? ' current-workflow-breadcrumb' : ''}`}
                aria-current={item.isCurrent ? 'step' : undefined}
              >
                <span>{item.label}</span>
                {index < breadcrumbItems.length - 1 ? <span className="workflow-breadcrumb-separator">/</span> : null}
              </span>
            ))}
          </span>
        )}
        title={stepLabel}
        intro={stepDescription}
        secondaryIntro="Each workflow page now isolates one stage of the journey while still reading the same root session state and vendor configuration."
      />

      <PageSection
        id={`${stepKey}-journey`}
        eyebrow="Journey navigation"
        title="Page-by-page workflow"
        copy="Use the pager to move through the journey while keeping the current session, vendor, and wallet state intact."
        stacked
      >
        <div className="journey-progress" aria-label="Workflow progression">
          <button
            type="button"
            className="journey-nav-button"
            onClick={() => previousPageId && onNavigate(previousPageId)}
            disabled={!previousPageId}
          >
            Previous
          </button>

          <div className="journey-progress-track">
            {stepPages.map((page) => {
              const pageStatus = page.stepKey ? session?.[page.stepKey].status : undefined;
              const isCurrentPage = page.stepKey === stepKey;

              return (
                <button
                  key={page.id}
                  type="button"
                  className={`journey-progress-step${isCurrentPage ? ' current-journey-step' : ''}`}
                  data-state={pageStatus}
                  disabled={page.disabled}
                  onClick={() => onNavigate(page.id)}
                >
                  <span className="journey-progress-index">{page.stepNumber}</span>
                  <span className="journey-progress-copy">
                    <strong>{page.label}</strong>
                    <span>{pageStatus ? workflowStatusLabels[pageStatus] : 'Not started'}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            className="journey-nav-button"
            onClick={() => nextPageId && onNavigate(nextPageId)}
            disabled={!nextPageId}
          >
            Next
          </button>
        </div>

        <div className="service-grid">
          <section className="panel">
            <div className="panel-heading-inline">
              <strong>{currentStep?.title ?? stepLabel}</strong>
              <span className="vendor-badge">{workflowStatusLabels[currentStep?.status ?? 'not-started']}</span>
            </div>

            {isEvidenceStep && stepRecordView ? (
              <div className="step-panel-content">
                <p className="supporting-copy">{currentStep?.summary ?? stepDescription}</p>
                {stepRecordView}
                <p className="supporting-copy">{statusNotes[currentStep?.status ?? 'not-started']}</p>
              </div>
            ) : isEvidenceStep && currentRequest ? (
              <div className="step-panel-content">
                <p className="panel-label">{requestHeading}</p>
                <p className="supporting-copy">{requestDescription}</p>
                <WorkflowQrEvidenceCard
                  className="workflow-step-request-panel"
                  copy=""
                  qrValue={currentRequest.qrCodeValue}
                  qrAlt={requestQrAlt}
                  exchangeId={currentRequest.exchangeId ?? 'Pending'}
                  requestUri={currentRequest.requestUri}
                  presentationDefinitionId={currentRequest.presentationDefinitionId ?? 'Dynamic'}
                  deepLink={currentRequest.openId4VpUri}
                />
                <p className="supporting-copy">{statusNotes[currentStep?.status ?? 'not-started']}</p>
              </div>
            ) : (
              <>
                <p className="supporting-copy">{currentStep?.summary ?? stepDescription}</p>
                <p className="supporting-copy">{statusNotes[currentStep?.status ?? 'not-started']}</p>
              </>
            )}

            {isEvidenceStep && currentError ? (
              <div className="message-box step-error-box">
                <strong>{currentError}</strong>
                <p>The current step failed in the normalized session state. Retry the action from this step card when ready.</p>
              </div>
            ) : null}

            <div className="step-actions">
              {isSucceededEvidenceStep ? (
                <button
                  type="button"
                  className="action-button"
                  onClick={() => nextPageId && onNavigate(nextPageId)}
                  disabled={!nextPageId}
                >
                  Continue to next step
                </button>
              ) : null}
              {isSucceededEvidenceStep ? (
                <button
                  type="button"
                  className="action-button action-button-secondary"
                  onClick={() => onRestartStep(stepKey)}
                  disabled={!canTriggerVendorActions}
                >
                  {reRequestLabel}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="action-button"
                    onClick={() => onTriggerAction(stepKey)}
                    disabled={!canTriggerVendorActions || currentStep?.status === 'blocked'}
                  >
                    {primaryActionLabel}
                  </button>
                  {isMockLocalVendor ? (
                    <button
                      type="button"
                      className="action-button action-button-secondary"
                      onClick={() => onTriggerAction(stepKey, 'failure')}
                      disabled={!session}
                    >
                      Fail
                    </button>
                  ) : null}
                  {isEvidenceStep && currentStep?.status === 'pending' ? (
                    <button
                      type="button"
                      className="action-button action-button-secondary"
                      onClick={() => onResetStep(stepKey, 'ready', cancelMessage)}
                      disabled={!session}
                    >
                      Cancel
                    </button>
                  ) : null}
                </>
              )}
              {stepKey === 'vatIssuance' ? (
                <button
                  type="button"
                  className="action-button action-button-secondary"
                  onClick={() => onTriggerAction('issuanceStatus')}
                  disabled={!canTriggerVendorActions || currentStep?.status !== 'pending'}
                >
                  Refresh issuance status
                </button>
              ) : null}
            </div>
          </section>

          <section className="panel">
            <div className="panel-heading-inline">
              <strong>Current context</strong>
              <span className="vendor-badge">{selectedVendorOption?.badge ?? 'Loading'}</span>
            </div>
            <dl className="review-list compact-review-list">
              <div><dt>Vendor</dt><dd>{selectedVendorOption?.label ?? 'Loading vendor'}</dd></div>
              <div><dt>Session ID</dt><dd>{session?.sessionId ?? 'Not loaded'}</dd></div>
              <div><dt>Lifecycle</dt><dd>{session?.lifecycle ?? 'not-loaded'}</dd></div>
              <div><dt>Wallet lane</dt><dd>{currentStep?.walletRole ?? 'Pending'}</dd></div>
            </dl>

            <div className="status-list inline-status-list">
              <div className="status-item">
                <span>API health</span>
                <strong data-state={health.status}>{health.detail}</strong>
              </div>
              <div className="status-item">
                <span>Session API</span>
                <strong data-state={sessionState.status}>{sessionState.detail}</strong>
              </div>
            </div>
          </section>
        </div>
      </PageSection>

      {isReviewStep ? (
        <WorkflowReviewSection
          session={session}
          canTriggerVendorActions={canTriggerVendorActions}
          onTriggerAction={onTriggerAction}
          mode={stepKey === 'vatIssuance' ? 'issuance' : 'review'}
        />
      ) : isEvidenceStep ? null : (
        <WorkflowEvidenceSection session={session} isMockLocalVendor={isMockLocalVendor} focusStep={stepKey} />
      )}

      <WorkflowHistorySection session={session} />
    </>
  );
}