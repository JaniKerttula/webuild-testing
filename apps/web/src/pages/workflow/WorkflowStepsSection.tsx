import { getWorkflowStepSnapshots, type OrchestrationSession } from '@we-build/domain';

import { PageSection } from '../../components/PageLayout.js';
import { useI18n } from '../../i18n.js';
import { getActionLabels, getStatusNotes, getWorkflowStatusLabels } from '../../workflowUi.js';
import type { WorkflowPageProps } from './types.js';

type WorkflowStepsSectionProps = {
  session: OrchestrationSession | null;
  canTriggerVendorActions: boolean;
  isMockLocalVendor: boolean;
  onTriggerAction: WorkflowPageProps['onTriggerAction'];
};

export function WorkflowStepsSection({
  session,
  canTriggerVendorActions,
  isMockLocalVendor,
  onTriggerAction,
}: WorkflowStepsSectionProps) {
  const { locale } = useI18n();
  const actionLabels = getActionLabels(locale);
  const statusNotes = getStatusNotes(locale);
  const workflowStatusLabels = getWorkflowStatusLabels(locale);
  const stepCards = session ? getWorkflowStepSnapshots(session).filter((step) => step.key !== 'review') : [];

  return (
    <PageSection id="workflow-steps" eyebrow="Workflow steps" title="Current journey">
      <div className="card-grid" aria-label="Workflow steps">
        {stepCards.map((step) => (
          <article key={step.key} className="step-card" data-state={step.status}>
            <div className="step-card-top">
              <h4>{step.title}</h4>
              <span className="step-state">{workflowStatusLabels[step.status]}</span>
            </div>
            <p className="step-summary">{step.summary}</p>
            <p className="step-note">{statusNotes[step.status]}</p>
            <div className="step-meta">
              <span>{step.walletRole === 'operator' ? 'Operator step' : 'Wallet step'}</span>
            </div>
            <div className="step-actions">
              {step.key !== 'review' ? (
                <button
                  type="button"
                  className="action-button"
                  onClick={() => onTriggerAction(step.key)}
                  disabled={!canTriggerVendorActions || step.status === 'blocked'}
                >
                  {actionLabels[step.key]}
                </button>
              ) : null}
              {isMockLocalVendor ? (
                <button
                  type="button"
                  className="action-button action-button-secondary"
                  onClick={() => onTriggerAction(step.key, 'failure')}
                  disabled={!session || step.key === 'review'}
                >
                  Fail
                </button>
              ) : null}
              {step.key === 'vatIssuance' ? (
                <button
                  type="button"
                  className="action-button action-button-secondary"
                  onClick={() => onTriggerAction('issuanceStatus')}
                  disabled={!canTriggerVendorActions || step.status !== 'pending'}
                >
                  Complete
                </button>
              ) : null}
            </div>
          </article>
        ))}
        {!stepCards.length ? (
          <article className="step-card" data-state="not-started">
            <div className="step-card-top">
              <h4>Session not loaded</h4>
              <span className="step-state">Waiting</span>
            </div>
            <p className="step-summary">The workflow cards appear after the session API responds.</p>
            <p className="step-note">Use reload or start a new session if the local API was restarted.</p>
            <div className="step-meta">
              <span>Session API step</span>
            </div>
          </article>
        ) : null}
      </div>
    </PageSection>
  );
}