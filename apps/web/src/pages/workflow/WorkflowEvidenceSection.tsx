import type { OrchestrationSession } from '@we-build/domain';

import { PageSection } from '../../components/PageLayout.js';
import { useI18n } from '../../i18n.js';
import { getWorkflowStatusLabels } from '../../workflowUi.js';
import { WorkflowQrEvidenceCard, WorkflowQrPanel } from './WorkflowShared.js';

type WorkflowEvidenceSectionProps = {
  session: OrchestrationSession | null;
  isMockLocalVendor: boolean;
  focusStep: 'pid' | 'poa' | 'eucc';
};

export function WorkflowEvidenceSection({ session, isMockLocalVendor, focusStep }: WorkflowEvidenceSectionProps) {
  const { locale, t } = useI18n();
  const workflowStatusLabels = getWorkflowStatusLabels(locale);
  const pidStepData = session?.pid.data;
  const pidRecord = pidStepData?.record;
  const pidPresentationRequest = pidStepData?.request;
  const poaStepData = session?.poa.data;
  const poaRecord = poaStepData?.record;
  const poaPresentationRequest = poaStepData?.request;
  const euccStepData = session?.eucc.data;
  const euccRecord = euccStepData?.record;
  const euccPresentationRequest = euccStepData?.request;
  const focusedConfig = t.evidence.stepCopy[focusStep];

  const focusedContent = focusStep === 'pid'
    ? {
        status: session?.pid.status ?? 'not-started',
        requestTitle: t.evidence.requestTitle.pid,
        requestDescription: t.evidence.requestDescription.pid,
        request: pidPresentationRequest,
        qrAlt: t.evidence.qrAlt.pid,
        record: pidRecord,
        recordView: pidRecord ? (
          <dl className="review-list compact-review-list">
            <div><dt>{t.fields.fullName}</dt><dd>{pidRecord.fullName}</dd></div>
            <div><dt>{t.fields.dateOfBirth}</dt><dd>{pidRecord.dateOfBirth}</dd></div>
            <div><dt>{t.fields.issuer}</dt><dd>{pidRecord.issuerName}</dd></div>
          </dl>
        ) : null,
      }
    : focusStep === 'poa'
      ? {
          status: session?.poa.status ?? 'not-started',
          requestTitle: t.evidence.requestTitle.poa,
          requestDescription: t.evidence.requestDescription.poa,
          request: poaPresentationRequest,
          qrAlt: t.evidence.qrAlt.poa,
          record: poaRecord,
          recordView: poaRecord ? (
            <dl className="review-list compact-review-list">
              <div><dt>{t.fields.attorney}</dt><dd>{poaRecord.attorneyName}</dd></div>
              <div><dt>{t.fields.principal}</dt><dd>{poaRecord.principalName}</dd></div>
              <div><dt>{t.fields.scope}</dt><dd>{poaRecord.scope.join(', ')}</dd></div>
            </dl>
          ) : null,
        }
      : {
          status: session?.eucc.status ?? 'not-started',
          requestTitle: t.evidence.requestTitle.eucc,
          requestDescription: t.evidence.requestDescription.eucc,
          request: euccPresentationRequest,
          qrAlt: t.evidence.qrAlt.eucc,
          record: euccRecord,
          recordView: euccRecord ? (
            <dl className="review-list compact-review-list">
              <div><dt>{t.fields.company}</dt><dd>{euccRecord.companyName}</dd></div>
              <div><dt>{t.fields.legalForm}</dt><dd>{euccRecord.legalForm}</dd></div>
              <div><dt>{t.fields.memberState}</dt><dd>{euccRecord.registrationMemberState}</dd></div>
            </dl>
          ) : null,
        };

  const prerequisiteItems = [
    {
      label: t.navigation.stepLabels.pid,
      status: session?.pid.status ?? 'not-started',
      detail: pidRecord
        ? pidRecord.fullName
        : pidPresentationRequest
          ? t.evidence.prerequisiteWaiting.requestCreated
          : t.evidence.prerequisiteWaiting.pid,
    },
    {
      label: t.navigation.stepLabels.poa,
      status: session?.poa.status ?? 'not-started',
      detail: poaRecord
        ? poaRecord.attorneyName
        : poaPresentationRequest
          ? t.evidence.prerequisiteWaiting.requestCreated
          : t.evidence.prerequisiteWaiting.poa,
    },
    {
      label: t.navigation.stepLabels.eucc,
      status: session?.eucc.status ?? 'not-started',
      detail: euccRecord
        ? euccRecord.companyName
        : euccPresentationRequest
          ? t.evidence.prerequisiteWaiting.requestCreated
          : t.evidence.prerequisiteWaiting.eucc,
    },
  ].filter((item) => item.label !== t.navigation.stepLabels[focusStep]);

  return (
    <PageSection
      id="evidence-map"
      eyebrow={focusedConfig.eyebrow}
      title={focusedConfig.title}
      copy={focusedConfig.copy}
      stacked
    >
      {focusedContent.request ? (
        <WorkflowQrPanel
          title={focusedContent.requestTitle}
          badge="OIDC4VP"
          description={focusedContent.requestDescription}
          qrValue={focusedContent.request.qrCodeValue}
          qrAlt={focusedContent.qrAlt}
          metadata={[
            { label: t.fields.exchangeId, value: focusedContent.request.exchangeId ?? t.common.pending },
            { label: t.fields.requestUri, value: focusedContent.request.requestUri },
            { label: t.fields.presentationDefinition, value: focusedContent.request.presentationDefinitionId ?? t.common.dynamic },
          ]}
          primaryAction={{ href: focusedContent.request.openId4VpUri, label: t.common.openWalletDeepLink }}
          secondaryAction={{ href: focusedContent.request.requestUri, label: t.common.openRequestUri }}
        />
      ) : null}

      <div className="message-box">
        <strong>{t.evidence.dataOrigin}</strong>
        <p>
          {isMockLocalVendor
            ? t.evidence.dataOriginCopy.mockLocal
            : t.evidence.dataOriginCopy.external}
        </p>
      </div>

      <div className="service-grid">
        <section className="panel evidence-column">
          <div className="panel-heading-inline">
            <strong>{focusedConfig.panelTitle}</strong>
            <span className="vendor-badge">{focusedConfig.laneBadge}</span>
          </div>

          <article className="evidence-card" data-state={focusedContent.status}>
            <div className="evidence-card-top">
              <h4>{t.navigation.stepLabels[focusStep]}</h4>
              <div className="evidence-badges">
                <span className="step-state">{workflowStatusLabels[focusedContent.status]}</span>
                {isMockLocalVendor ? <span className="mock-badge">{t.evidence.mockFixture}</span> : null}
              </div>
            </div>
            {focusedContent.recordView ? focusedContent.recordView : focusedContent.request ? (
              <WorkflowQrEvidenceCard
                copy={t.evidence.requestCardCopy[focusStep]}
                qrValue={focusedContent.request.qrCodeValue}
                qrAlt={focusedContent.qrAlt}
                exchangeId={focusedContent.request.exchangeId ?? t.common.pending}
                requestUri={focusedContent.request.requestUri}
                presentationDefinitionId={focusedContent.request.presentationDefinitionId ?? t.common.dynamic}
                deepLink={focusedContent.request.openId4VpUri}
              />
            ) : (
              <p className="supporting-copy">{focusedConfig.emptyCopy}</p>
            )}
          </article>
        </section>

        <section className="panel evidence-column">
          <div className="panel-heading-inline">
            <strong>{t.evidence.prerequisiteState}</strong>
            <span className="vendor-badge">{t.evidence.dependencyMap}</span>
          </div>

          <ul className="history-list prerequisite-list" aria-label={t.evidence.prerequisiteListAria}>
            {prerequisiteItems.map((item) => (
              <li key={item.label}>
                <div className="history-meta">
                  <strong>{item.label}</strong>
                  <span>{workflowStatusLabels[item.status]}</span>
                </div>
                <p>{item.detail}</p>
              </li>
            ))}
          </ul>

          {session?.[focusStep].error?.message ? (
            <div className="message-box step-error-box">
              <strong>{session[focusStep].error?.message}</strong>
              <p>{t.evidence.currentStepFailed}</p>
            </div>
          ) : null}
        </section>
      </div>
    </PageSection>
  );
}