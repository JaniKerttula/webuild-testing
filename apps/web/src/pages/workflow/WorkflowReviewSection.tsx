import { useEffect, useRef } from 'react';

import { workflowStatusLabels, type OrchestrationSession } from '@we-build/domain';

import { statusNotes } from '../../workflowUi.js';
import { formatTimestamp } from './WorkflowShared.js';
import type { WorkflowPageProps } from './types.js';

type WorkflowReviewSectionProps = {
  session: OrchestrationSession | null;
  canTriggerVendorActions: boolean;
  onTriggerAction: WorkflowPageProps['onTriggerAction'];
  mode?: 'review' | 'issuance';
};

export function WorkflowReviewSection({
  session,
  canTriggerVendorActions,
  onTriggerAction,
  mode = 'review',
}: WorkflowReviewSectionProps) {
  const reviewPayload = session?.review.data;
  const issuanceResult = session?.vatIssuance.data;
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
    <div className="card-grid" aria-label={isIssuanceMode ? 'Issuance cards' : 'Review cards'}>
      <article className="step-card" data-state={session?.review.status ?? 'not-started'}>
        <div className="step-card-top">
          <h4>{isIssuanceMode ? 'Review source' : 'Review payload'}</h4>
          <span className="step-state">{workflowStatusLabels[session?.review.status ?? 'not-started']}</span>
        </div>
        <p className="step-summary">
          {isIssuanceMode
            ? 'The review payload below is the source material used for the VAT issuance request.'
            : 'Assemble PID, company, PoA, and EUCC into one review object.'}
        </p>
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
          <span>{isIssuanceMode ? 'Issuance preparation step' : 'Operator step'}</span>
        </div>
      </article>

      <article className="step-card" data-state={session?.vatIssuance.status ?? 'not-started'}>
        <div className="step-card-top">
          <h4>{isIssuanceMode ? 'VAT issuance result' : 'Issuance result'}</h4>
          <span className="step-state">{workflowStatusLabels[session?.vatIssuance.status ?? 'not-started']}</span>
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
          <span>{isIssuanceMode ? 'Company step' : 'Submission result'}</span>
        </div>
      </article>
    </div>
  );
}