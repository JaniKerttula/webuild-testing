import { useEffect, useRef } from 'react';

import type { OrchestrationSession } from '@we-build/domain';

import { useI18n } from '../../i18n.js';
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
  const { t } = useI18n();
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
        {!isIssuanceMode ? (
          <>
            <div className="review-layout">
              <div className="review-column">
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
              </div>

              <div className="review-column">
                <div className="review-block review-highlight-block">
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
              </div>
            </div>

            <p className="supporting-copy">{t.review.assembledAt} {formatTimestamp(reviewPayload.assembledAt)}.</p>
          </>
        ) : null}

        {!isIssuanceMode ? (
          <div className="step-actions">
            <button
              type="button"
              className="action-button"
              onClick={() => nextPageId && onNavigateToNextStep?.(nextPageId)}
              disabled={!nextPageId || !onNavigateToNextStep}
            >
              {t.common.continueToNextStep}
            </button>
          </div>
        ) : null}
      </>
    ) : (
      <p className="supporting-copy">
        {t.review.automaticHint}
      </p>
    )
  );
}