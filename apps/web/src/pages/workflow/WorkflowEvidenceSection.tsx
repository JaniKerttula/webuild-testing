import { workflowStatusLabels, type OrchestrationSession } from '@we-build/domain';

import { PageSection } from '../../components/PageLayout.js';
import { WorkflowQrEvidenceCard, WorkflowQrPanel } from './WorkflowShared.js';

type WorkflowEvidenceSectionProps = {
  session: OrchestrationSession | null;
  isMockLocalVendor: boolean;
  focusStep: 'pid' | 'poa' | 'eucc';
};

const stepCopy = {
  pid: {
    eyebrow: 'PID step',
    title: 'PID collection surface',
    copy: 'This page focuses on collecting personal identity evidence from the personal wallet before downstream steps become available.',
    panelTitle: 'PID evidence',
    laneBadge: 'Personal wallet',
    emptyCopy: 'No PID data collected yet.',
  },
  poa: {
    eyebrow: 'PoA step',
    title: 'PoA collection surface',
    copy: 'This page focuses on power-of-attorney evidence and keeps PID availability visible as upstream context.',
    panelTitle: 'PoA evidence',
    laneBadge: 'Personal wallet',
    emptyCopy: 'No PoA data collected yet.',
  },
  eucc: {
    eyebrow: 'EUCC step',
    title: 'EUCC collection surface',
    copy: 'This page focuses on organisation evidence from the company wallet and shows the prerequisite identity state alongside it.',
    panelTitle: 'EUCC evidence',
    laneBadge: 'Company wallet',
    emptyCopy: 'No EUCC data collected yet.',
  },
} as const;

export function WorkflowEvidenceSection({ session, isMockLocalVendor, focusStep }: WorkflowEvidenceSectionProps) {
  const pidStepData = session?.pid.data;
  const pidRecord = pidStepData?.record;
  const pidPresentationRequest = pidStepData?.request;
  const poaStepData = session?.poa.data;
  const poaRecord = poaStepData?.record;
  const poaPresentationRequest = poaStepData?.request;
  const euccStepData = session?.eucc.data;
  const euccRecord = euccStepData?.record;
  const euccPresentationRequest = euccStepData?.request;
  const focusedConfig = stepCopy[focusStep];

  const focusedContent = focusStep === 'pid'
    ? {
        status: session?.pid.status ?? 'not-started',
        requestTitle: 'PID presentation request',
        requestDescription: 'Scan this QR code with the wallet to open the iGrant verification request and start transferring PID data back to the verifier.',
        request: pidPresentationRequest,
        qrAlt: 'PID presentation request QR code',
        record: pidRecord,
        recordView: pidRecord ? (
          <dl className="review-list compact-review-list">
            <div><dt>Full name</dt><dd>{pidRecord.fullName}</dd></div>
            <div><dt>Date of birth</dt><dd>{pidRecord.dateOfBirth}</dd></div>
            <div><dt>Issuer</dt><dd>{pidRecord.issuerName}</dd></div>
          </dl>
        ) : null,
      }
    : focusStep === 'poa'
      ? {
          status: session?.poa.status ?? 'not-started',
          requestTitle: 'PoA presentation request',
          requestDescription: 'Scan this QR code with the wallet to open the iGrant verification request and start transferring PoA data back to the verifier.',
          request: poaPresentationRequest,
          qrAlt: 'PoA presentation request QR code',
          record: poaRecord,
          recordView: poaRecord ? (
            <dl className="review-list compact-review-list">
              <div><dt>Attorney</dt><dd>{poaRecord.attorneyName}</dd></div>
              <div><dt>Principal</dt><dd>{poaRecord.principalName}</dd></div>
              <div><dt>Scope</dt><dd>{poaRecord.scope.join(', ')}</dd></div>
            </dl>
          ) : null,
        }
      : {
          status: session?.eucc.status ?? 'not-started',
          requestTitle: 'EUCC presentation request',
          requestDescription: 'Scan this QR code with the company wallet to open the iGrant verification request and start transferring EUCC data back to the verifier.',
          request: euccPresentationRequest,
          qrAlt: 'EUCC presentation request QR code',
          record: euccRecord,
          recordView: euccRecord ? (
            <dl className="review-list compact-review-list">
              <div><dt>Company</dt><dd>{euccRecord.companyName}</dd></div>
              <div><dt>Legal form</dt><dd>{euccRecord.legalForm}</dd></div>
              <div><dt>Member state</dt><dd>{euccRecord.registrationMemberState}</dd></div>
            </dl>
          ) : null,
        };

  const prerequisiteItems = [
    {
      label: 'PID identification',
      status: session?.pid.status ?? 'not-started',
      detail: pidRecord
        ? pidRecord.fullName
        : pidPresentationRequest
          ? 'Presentation request created'
          : 'Waiting for identity evidence',
    },
    {
      label: 'PoA collection',
      status: session?.poa.status ?? 'not-started',
      detail: poaRecord
        ? poaRecord.attorneyName
        : poaPresentationRequest
          ? 'Presentation request created'
          : 'Waiting for authorization evidence',
    },
    {
      label: 'EUCC collection',
      status: session?.eucc.status ?? 'not-started',
      detail: euccRecord
        ? euccRecord.companyName
        : euccPresentationRequest
          ? 'Presentation request created'
          : 'Waiting for organisation evidence',
    },
  ].filter((item) => item.label !== (focusStep === 'pid' ? 'PID identification' : focusStep === 'poa' ? 'PoA collection' : 'EUCC collection'));

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
            { label: 'Exchange ID', value: focusedContent.request.exchangeId ?? 'Pending' },
            { label: 'Request URI', value: focusedContent.request.requestUri },
            { label: 'Presentation definition', value: focusedContent.request.presentationDefinitionId ?? 'Dynamic' },
          ]}
          primaryAction={{ href: focusedContent.request.openId4VpUri, label: 'Open wallet deep-link' }}
          secondaryAction={{ href: focusedContent.request.requestUri, label: 'Open request URI' }}
        />
      ) : null}

      <div className="message-box">
        <strong>Data origin</strong>
        <p>
          {isMockLocalVendor
            ? 'All values shown below come from local repository fixtures and normalized mock adapter responses.'
            : 'This vendor is modeled to use external wallet applications, so values appear only when normalized adapter responses are returned.'}
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
              <h4>{focusStep === 'pid' ? 'PID identification' : focusStep === 'poa' ? 'PoA collection' : 'EUCC collection'}</h4>
              <div className="evidence-badges">
                <span className="step-state">{workflowStatusLabels[focusedContent.status]}</span>
                {isMockLocalVendor ? <span className="mock-badge">Mock fixture</span> : null}
              </div>
            </div>
            {focusedContent.recordView ? focusedContent.recordView : focusedContent.request ? (
              <WorkflowQrEvidenceCard
                copy={`Scan the QR code with a compatible wallet to present ${focusStep === 'eucc' ? 'EUCC' : focusStep.toUpperCase()} through the live iGrant OIDC4VP verifier flow.`}
                qrValue={focusedContent.request.qrCodeValue}
                qrAlt={focusedContent.qrAlt}
                exchangeId={focusedContent.request.exchangeId ?? 'Pending'}
                requestUri={focusedContent.request.requestUri}
                presentationDefinitionId={focusedContent.request.presentationDefinitionId ?? 'Dynamic'}
                deepLink={focusedContent.request.openId4VpUri}
              />
            ) : (
              <p className="supporting-copy">{focusedConfig.emptyCopy}</p>
            )}
          </article>
        </section>

        <section className="panel evidence-column">
          <div className="panel-heading-inline">
            <strong>Prerequisite state</strong>
            <span className="vendor-badge">Dependency map</span>
          </div>

          <ul className="history-list prerequisite-list" aria-label="Prerequisite steps">
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
              <p>The current step failed in the normalized session state. Retry the action from the step control panel when ready.</p>
            </div>
          ) : null}
        </section>
      </div>
    </PageSection>
  );
}