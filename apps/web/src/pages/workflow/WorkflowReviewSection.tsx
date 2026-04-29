import { useEffect, useRef } from 'react';

import type { OrchestrationSession } from '@we-build/domain';

import { formatTimestamp } from './WorkflowShared.js';
import type { JourneyPageId, WorkflowPageProps } from './types.js';

type WorkflowReviewSectionProps = {
  session: OrchestrationSession | null;
  canTriggerVendorActions: boolean;
  onTriggerAction: WorkflowPageProps['onTriggerAction'];
  nextPageId?: JourneyPageId;
  onNavigateToNextStep?: (pageId: JourneyPageId) => void;
  mode?: 'review' | 'issuance';
};

export function WorkflowReviewSection({
  session,
  canTriggerVendorActions,
  onTriggerAction,
  nextPageId,
  onNavigateToNextStep,
  mode = 'review',
}: WorkflowReviewSectionProps) {
  const reviewPayload = session?.review.data;
  const isIssuanceMode = mode === 'issuance';
  const lastAutoAssembleKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!session || isIssuanceMode || !canTriggerVendorActions) {
      return;
    }

    if (session.review.status !== 'ready' || reviewPayload) {
      return;
    }

    const autoAssembleKey = `${session.sessionId}:${session.updatedAt}:${session.review.status}`;

    if (lastAutoAssembleKeyRef.current === autoAssembleKey) {
      return;
    }

    lastAutoAssembleKeyRef.current = autoAssembleKey;
    onTriggerAction('review');
  }, [canTriggerVendorActions, isIssuanceMode, onTriggerAction, reviewPayload, session]);

  return (
    reviewPayload ? (
      <>
        <div className="review-layout">
          <div className="review-column">
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
          </div>

          <div className="review-column">
            <div className="review-block review-highlight-block">
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
          </div>
        </div>

        <p className="supporting-copy">Assembled at {formatTimestamp(reviewPayload.assembledAt)}.</p>

        {!isIssuanceMode ? (
          <div className="step-actions">
            <button
              type="button"
              className="action-button"
              onClick={() => nextPageId && onNavigateToNextStep?.(nextPageId)}
              disabled={!nextPageId || !onNavigateToNextStep}
            >
              Continue to next step
            </button>
          </div>
        ) : null}
      </>
    ) : (
      <p className="supporting-copy">
        The review payload appears automatically after PID, PoA, and EUCC succeed.
      </p>
    )
  );
}