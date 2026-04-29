import { workflowStatusLabels, type OrchestrationSession } from '@we-build/domain';

import { PageSection } from '../../components/PageLayout.js';
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

  return (
    <PageSection
      id="review-submit"
      eyebrow={isIssuanceMode ? 'Issuance step' : 'Review step'}
      title={isIssuanceMode ? 'Issuance tracking and result' : 'Assembled payload and issuance control'}
      copy={isIssuanceMode
        ? 'This page focuses on the submission result and follow-up status refresh once the review payload has already been assembled.'
        : 'This page focuses on the assembled review payload before the issuance request is submitted.'}
    >
      <div className="service-grid review-grid">
        <section className="panel">
          <div className="panel-heading-inline">
            <strong>{isIssuanceMode ? 'Review source' : 'Review payload'}</strong>
            <span className="vendor-badge">{workflowStatusLabels[session?.review.status ?? 'not-started']}</span>
          </div>

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
              Assemble the review step after PID, PoA, and EUCC have succeeded. This panel becomes the explicit submission surface for VAT issuance.
            </p>
          )}

          <div className="action-row">
            {!isIssuanceMode ? (
              <button
                type="button"
                className="action-button"
                onClick={() => onTriggerAction('review')}
                disabled={!canTriggerVendorActions || session?.review.status === 'blocked'}
              >
                Assemble review
              </button>
            ) : null}
            <button
              type="button"
              className="action-button"
              onClick={() => onTriggerAction('vatIssuance')}
              disabled={!canTriggerVendorActions || session?.review.status !== 'succeeded'}
            >
              Submit VAT issuance
            </button>
            <button
              type="button"
              className="action-button action-button-secondary"
              onClick={() => onTriggerAction('issuanceStatus')}
              disabled={!canTriggerVendorActions || session?.vatIssuance.status !== 'pending'}
            >
              Refresh issuance status
            </button>
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading-inline">
            <strong>{isIssuanceMode ? 'VAT issuance result' : 'Issuance result'}</strong>
            <span className="vendor-badge">{workflowStatusLabels[session?.vatIssuance.status ?? 'not-started']}</span>
          </div>

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
        </section>
      </div>
    </PageSection>
  );
}