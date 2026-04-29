import type { WorkflowStepKey } from '@we-build/domain';

import { PageHero, PageSection } from '../components/PageLayout.js';
import { WorkflowSessionSection } from './workflow/WorkflowSessionSection.js';
import type { JourneyNavigationItem, JourneyPageId, WorkflowPageProps } from './workflow/types.js';

type LandingPageProps = WorkflowPageProps & {
  stepPages: JourneyNavigationItem[];
  onNavigate: (pageId: JourneyPageId) => void;
  onStartWorkflow: () => void;
};

function isWorkflowStepKey(value: JourneyPageId): value is WorkflowStepKey {
  return value !== 'landing';
}

export function LandingPage({
  apiBaseUrl,
  vendorOptions,
  selectedVendor,
  selectedVendorOption,
  session,
  sessionState,
  health,
  onVendorChange,
  onStartNewSession,
  onSeedWalletCredential,
  stepPages,
  onNavigate,
  onStartWorkflow,
}: LandingPageProps) {
  return (
    <>
      <PageHero
        eyebrow="Landing page"
        title="Local VAT attestation test journey"
        intro="Choose a vendor profile, preload test credentials, and walk the orchestration flow page by page."
        secondaryIntro="This app is a local testing workspace for wallet seeding, session orchestration, and vendor-shaped credential exchange before each workflow page gets its final task-specific UI."
      />

      <WorkflowSessionSection
        apiBaseUrl={apiBaseUrl}
        vendorOptions={vendorOptions}
        selectedVendor={selectedVendor}
        selectedVendorOption={selectedVendorOption}
        session={session}
        sessionState={sessionState}
        health={health}
        stepCount={stepPages.length}
        onVendorChange={onVendorChange}
        onStartNewSession={onStartNewSession}
        showWalletSetup
        onSeedWalletCredential={onSeedWalletCredential}
      />

      <PageSection
        id="journey-overview"
        eyebrow="Journey"
        title="Workflow pages"
        copy="The workflow is now split into separate pages so each step can evolve independently without forcing every control and evidence panel into a single screen."
        stacked
      >
        <div className="journey-grid" aria-label="Workflow pages">
          {stepPages.map((page) => (
            <article key={page.id} className="journey-card">
              <div className="journey-card-head">
                <span className="journey-step-index">Step {page.stepNumber}</span>
                <h4>{page.label}</h4>
              </div>
              <p className="supporting-copy">{page.description}</p>
              <button
                type="button"
                className="action-button action-button-secondary"
                disabled={page.disabled}
                onClick={() => {
                  if (isWorkflowStepKey(page.id)) {
                    onNavigate(page.id);
                  }
                }}
              >
                Open page
              </button>
            </article>
          ))}
        </div>

        <div className="action-row journey-primary-actions">
          <button type="button" className="action-button" onClick={onStartWorkflow} disabled={!stepPages.some((page) => !page.disabled)}>
            Start workflow
          </button>
        </div>
      </PageSection>
    </>
  );
}