import {
  getWorkflowStepSnapshots,
  workflowStatusLabels,
  type WorkflowStepKey,
} from '@we-build/domain';

import { PageHero, PageSection } from '../components/PageLayout.js';
import { actionLabels, statusNotes } from '../workflowUi.js';
import { WorkflowEvidenceSection } from './workflow/WorkflowEvidenceSection.js';
import { WorkflowHistorySection } from './workflow/WorkflowHistorySection.js';
import { WorkflowReviewSection } from './workflow/WorkflowReviewSection.js';
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
}: WorkflowStepPageProps) {
  const isMockLocalVendor = selectedVendorOption?.id === 'mock-local';
  const allowsExternalActions = selectedVendorOption?.walletInteraction.personal === 'external-wallet-app'
    || selectedVendorOption?.walletInteraction.company === 'external-wallet-app';
  const canTriggerVendorActions = Boolean(session) && (isMockLocalVendor || allowsExternalActions);
  const currentStep = session ? getWorkflowStepSnapshots(session).find((step) => step.key === stepKey) : undefined;
  const isReviewStep = stepKey === 'review' || stepKey === 'vatIssuance';

  return (
    <>
      <PageHero
        eyebrow={`Step ${stepNumber} of ${stepCount}`}
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
            <p className="supporting-copy">{currentStep?.summary ?? stepDescription}</p>
            <p className="supporting-copy">{statusNotes[currentStep?.status ?? 'not-started']}</p>

            <div className="step-actions">
              <button
                type="button"
                className="action-button"
                onClick={() => onTriggerAction(stepKey)}
                disabled={!canTriggerVendorActions || currentStep?.status === 'blocked'}
              >
                {actionLabels[stepKey]}
              </button>
              <button
                type="button"
                className="action-button action-button-secondary"
                onClick={() => onTriggerAction(stepKey, 'failure')}
                disabled={!session || !isMockLocalVendor}
              >
                Fail
              </button>
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
      ) : (
        <WorkflowEvidenceSection session={session} isMockLocalVendor={isMockLocalVendor} focusStep={stepKey} />
      )}

      <WorkflowHistorySection session={session} />
    </>
  );
}