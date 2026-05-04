import {
  getWorkflowStepSnapshots,
  type VatIssuanceOutcome,
  type WorkflowStepKey,
} from '@we-build/domain';

import { DetailList, PanelHeader, PageHero, type DetailListItem } from '../components/PageLayout.js';
import { formatTranslation, useI18n, type TranslationSet } from '../i18n.js';
import { getActionLabels, getStatusNotes, getWorkflowStatusLabels } from '../workflowUi.js';
import { WorkflowEvidenceSection } from './workflow/WorkflowEvidenceSection.js';
import { WorkflowHistorySection } from './workflow/WorkflowHistorySection.js';
import { WorkflowReviewSection } from './workflow/WorkflowReviewSection.js';
import { WalletCredentialCard, WorkflowQrEvidenceCard, formatTimestamp } from './workflow/WorkflowShared.js';
import type { JourneyNavigationItem, JourneyPageId, WorkflowPageProps } from './workflow/types.js';

type WorkflowStepPageProps = WorkflowPageProps & {
  stepKey: WorkflowStepKey;
  stepLabel: string;
  stepDescription: string;
  stepPages: JourneyNavigationItem[];
  openedPageIds: JourneyPageId[];
  onNavigate: (pageId: JourneyPageId) => void;
  nextPageId?: JourneyPageId;
};

type EvidenceStepKey = Extract<WorkflowStepKey, 'pid' | 'poa' | 'eucc'>;

function isEvidenceStepKey(stepKey: WorkflowStepKey): stepKey is EvidenceStepKey {
  return stepKey === 'pid' || stepKey === 'poa' || stepKey === 'eucc';
}

function getEvidenceRecordItems(
  session: WorkflowPageProps['session'],
  stepKey: EvidenceStepKey,
  t: TranslationSet,
): DetailListItem[] | null {
  switch (stepKey) {
    case 'pid': {
      const record = session?.pid.data?.record;

      if (!record) {
        return null;
      }

      return [
        { key: 'full-name', label: t.fields.fullName, value: record.fullName },
        { key: 'date-of-birth', label: t.fields.dateOfBirth, value: record.dateOfBirth },
        { key: 'issuer', label: t.fields.issuer, value: record.issuerName },
      ];
    }
    case 'poa': {
      const record = session?.poa.data?.record;

      if (!record) {
        return null;
      }

      return [
        { key: 'attorney', label: t.fields.attorney, value: record.attorneyName },
        { key: 'principal', label: t.fields.principal, value: record.principalName },
        { key: 'scope', label: t.fields.scope, value: record.scope.join(', ') },
      ];
    }
    case 'eucc': {
      const record = session?.eucc.data?.record;

      if (!record) {
        return null;
      }

      return [
        { key: 'company', label: t.fields.company, value: record.companyName },
        { key: 'legal-form', label: t.fields.legalForm, value: record.legalForm },
        { key: 'member-state', label: t.fields.memberState, value: record.registrationMemberState },
      ];
    }
  }
}

function getIssuanceStatusLabel(status: VatIssuanceOutcome, t: TranslationSet): string {
  if (status === 'issued') {
    return t.statuses.workflow.succeeded;
  }

  if (status === 'failed') {
    return t.statuses.workflow.failed;
  }

  return t.statuses.workflow[status];
}

export function WorkflowStepPage({
  selectedVendorOption,
  session,
  sessionState,
  health,
  stepKey,
  stepLabel,
  stepDescription,
  stepPages,
  openedPageIds,
  onNavigate,
  nextPageId,
  onTriggerAction,
  onResetStep,
  onRestartStep,
}: WorkflowStepPageProps) {
  const { locale, t } = useI18n();
  const actionLabels = getActionLabels(locale);
  const statusNotes = getStatusNotes(locale);
  const workflowStatusLabels = getWorkflowStatusLabels(locale);
  const isMockLocalVendor = selectedVendorOption?.id === 'mock-local';
  const allowsExternalActions = selectedVendorOption?.walletInteraction.personal === 'external-wallet-app'
    || selectedVendorOption?.walletInteraction.company === 'external-wallet-app';
  const canTriggerVendorActions = Boolean(session) && (isMockLocalVendor || allowsExternalActions);
  const currentStep = session ? getWorkflowStepSnapshots(session).find((step) => step.key === stepKey) : undefined;
  const isReviewStep = stepKey === 'review' || stepKey === 'vatIssuance';
  const evidenceStepKey = isEvidenceStepKey(stepKey) ? stepKey : null;
  const isEvidenceStep = evidenceStepKey !== null;
  const isSucceededEvidenceStep = isEvidenceStep && currentStep?.status === 'succeeded';
  const primaryActionLabel = isEvidenceStep && currentStep?.status === 'pending' ? t.common.retry : actionLabels[stepKey];
  const currentRequest = evidenceStepKey ? session?.[evidenceStepKey].data?.request : undefined;
  const currentError = evidenceStepKey ? session?.[evidenceStepKey].error?.message : undefined;
  const issuanceResult = stepKey === 'vatIssuance' ? session?.vatIssuance.data : undefined;
  const issuanceWalletCredential = issuanceResult?.walletCredential;
  const evidenceRecordItems = evidenceStepKey ? getEvidenceRecordItems(session, evidenceStepKey, t) : null;
  const heroIntro = t.workflowStep.heroIntro[stepKey] ?? stepDescription;
  const heroSecondaryIntro = isEvidenceStep ? undefined : t.workflowStep.heroSecondaryIntro;
  const breadcrumbItems = stepPages.map((page) => ({
    id: page.id,
    label: page.label,
    isCurrent: page.stepKey === stepKey,
    isOpened: openedPageIds.includes(page.id),
    isDisabled: page.disabled === true,
  }));

  return (
    <>
      <PageHero
        eyebrow={(
          <span className="workflow-breadcrumbs" aria-label={t.navigation.workflowBreadcrumbAria}>
            {breadcrumbItems.map((item, index) => (
              <span
                key={item.id}
                className={`workflow-breadcrumb${item.isCurrent ? ' current-workflow-breadcrumb' : item.isOpened && !item.isDisabled ? ' opened-workflow-breadcrumb' : ' inactive-workflow-breadcrumb'}`}
                aria-current={item.isCurrent ? 'step' : undefined}
              >
                {item.isCurrent ? (
                  <span>{item.label}</span>
                ) : item.isOpened && !item.isDisabled ? (
                  <button
                    type="button"
                    className="workflow-breadcrumb-button"
                    aria-label={formatTranslation(t.navigation.breadcrumbButtonAria, { label: item.label })}
                    onClick={() => onNavigate(item.id)}
                  >
                    {item.label}
                  </button>
                ) : (
                  <span>{item.label}</span>
                )}
                {index < breadcrumbItems.length - 1 ? <span className="workflow-breadcrumb-separator">/</span> : null}
              </span>
            ))}
          </span>
        )}
        title={stepLabel}
        intro={heroIntro}
        secondaryIntro={heroSecondaryIntro}
      />

      <div className="service-grid workflow-step-layout" id={`${stepKey}-journey`}>
          <section className="panel">
            <PanelHeader
              title={currentStep?.title ?? stepLabel}
              badge={workflowStatusLabels[currentStep?.status ?? 'not-started']}
            />

            {isEvidenceStep && evidenceRecordItems ? (
              <div className="step-panel-content">
                <p className="supporting-copy">{currentStep?.summary ?? stepDescription}</p>
                <DetailList compact items={evidenceRecordItems} />
                <p className="supporting-copy">{statusNotes[currentStep?.status ?? 'not-started']}</p>
              </div>
            ) : isEvidenceStep && currentRequest ? (
              <div className="step-panel-content">
                <p className="panel-label">{t.workflowStep.requestHeading[evidenceStepKey]}</p>
                <p className="supporting-copy">{t.workflowStep.requestDescription[evidenceStepKey]}</p>
                <WorkflowQrEvidenceCard
                  className="workflow-step-request-panel"
                  copy=""
                  qrValue={currentRequest.qrCodeValue}
                  qrAlt={t.workflowStep.requestQrAlt[evidenceStepKey]}
                  exchangeId={currentRequest.exchangeId ?? t.common.pending}
                  requestUri={currentRequest.requestUri}
                  presentationDefinitionId={currentRequest.presentationDefinitionId ?? t.common.dynamic}
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
                <p>{t.workflowStep.currentStepFailed}</p>
              </div>
            ) : null}

            {isReviewStep ? (
              <WorkflowReviewSection
                session={session}
                canTriggerVendorActions={canTriggerVendorActions}
                onTriggerAction={onTriggerAction}
                nextPageId={nextPageId}
                onNavigateToNextStep={onNavigate}
                mode={stepKey === 'vatIssuance' ? 'issuance' : 'review'}
              />
            ) : null}

            {stepKey === 'vatIssuance' && issuanceResult ? (
              <div className="step-panel-content issuance-detail-section">
                <div className="review-block">
                  <PanelHeader title={t.workflowStep.issuanceDetails} badge={<span className="step-state">{getIssuanceStatusLabel(issuanceResult.status, t)}</span>} />
                  <DetailList
                    compact
                    items={[
                      { key: 'vat-id', label: t.workflowStep.issuanceFields.vatId, value: issuanceResult.vatId },
                      { key: 'exchange-id', label: t.workflowStep.issuanceFields.exchangeId, value: issuanceResult.exchangeId ?? t.common.pending },
                      { key: 'administrative-unit', label: t.workflowStep.issuanceFields.administrativeUnit, value: issuanceResult.administrativeUnitName },
                      { key: 'issuer', label: t.workflowStep.issuanceFields.issuer, value: issuanceResult.issuingOrganisation },
                      { key: 'country', label: t.workflowStep.issuanceFields.country, value: issuanceResult.issuingCountry },
                      { key: 'issued-at', label: t.workflowStep.issuanceFields.issuedAt, value: formatTimestamp(issuanceResult.issuedAt, locale, t.common.notAvailable) },
                    ]}
                  />
                </div>

                {issuanceWalletCredential ? (
                  <ul className="wallet-list">
                    <WalletCredentialCard credential={issuanceWalletCredential} />
                  </ul>
                ) : null}
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
                  {t.common.continueToNextStep}
                </button>
              ) : null}
              {isSucceededEvidenceStep ? (
                <button
                  type="button"
                  className="action-button action-button-secondary"
                  onClick={() => onRestartStep(stepKey)}
                  disabled={!canTriggerVendorActions}
                >
                  {t.workflowStep.reRequestLabel[evidenceStepKey]}
                </button>
              ) : (
                <>
                  {stepKey === 'vatIssuance' ? (
                    <>
                      <button
                        type="button"
                        className="action-button"
                        onClick={() => onTriggerAction('vatIssuance')}
                        disabled={!canTriggerVendorActions || session?.review.status !== 'succeeded' || currentStep?.status === 'pending'}
                      >
                        {t.workflowStep.submitVatIssuance}
                      </button>
                      <button
                        type="button"
                        className="action-button action-button-secondary"
                        onClick={() => onRestartStep('vatIssuance')}
                        disabled={!session || !canTriggerVendorActions || session?.review.status !== 'succeeded'}
                      >
                        {t.actions.restartVatIssuance}
                      </button>
                    </>
                  ) : null}
                  {!isReviewStep ? (
                    <button
                      type="button"
                      className="action-button"
                      onClick={() => onTriggerAction(stepKey)}
                      disabled={!canTriggerVendorActions || currentStep?.status === 'blocked'}
                    >
                      {primaryActionLabel}
                    </button>
                  ) : null}
                  {isMockLocalVendor ? (
                    <button
                      type="button"
                      className="action-button action-button-secondary"
                      onClick={() => onTriggerAction(stepKey, 'failure')}
                      disabled={!session || isReviewStep}
                    >
                      {t.common.fail}
                    </button>
                  ) : null}
                  {isEvidenceStep && currentStep?.status === 'pending' ? (
                    <button
                      type="button"
                      className="action-button action-button-secondary"
                      onClick={() => onResetStep(stepKey, 'ready', t.workflowStep.cancelMessage[evidenceStepKey])}
                      disabled={!session}
                    >
                      {t.common.cancel}
                    </button>
                  ) : null}
                </>
              )}
            </div>
          </section>

          <section className="panel">
            <PanelHeader title={t.workflowStep.currentContext} badge={selectedVendorOption?.badge ?? t.common.loading} />
            <DetailList
              compact
              items={[
                { key: 'vendor', label: t.workflowStep.currentContextFields.vendor, value: selectedVendorOption?.label ?? t.common.loadingVendor },
                { key: 'session-id', label: t.workflowStep.currentContextFields.sessionId, value: session?.sessionId ?? t.common.notLoaded },
                { key: 'lifecycle', label: t.workflowStep.currentContextFields.lifecycle, value: session?.lifecycle ?? t.common.notLoaded },
                { key: 'wallet-lane', label: t.workflowStep.currentContextFields.walletLane, value: currentStep?.walletRole ? t.wallets.walletRoleLabels[currentStep.walletRole] : t.common.pending },
              ]}
            />

            <div className="status-list inline-status-list">
              <div className="status-item">
                <span>{t.workflowStep.currentContextFields.apiHealth}</span>
                <strong data-state={health.status}>{health.detail}</strong>
              </div>
              <div className="status-item">
                <span>{t.workflowStep.currentContextFields.sessionApi}</span>
                <strong data-state={sessionState.status}>{sessionState.detail}</strong>
              </div>
            </div>
          </section>
      </div>

      {isReviewStep ? null : isEvidenceStep ? null : (
        <WorkflowEvidenceSection session={session} isMockLocalVendor={isMockLocalVendor} focusStep={stepKey} />
      )}

      <WorkflowHistorySection session={session} />
    </>
  );
}