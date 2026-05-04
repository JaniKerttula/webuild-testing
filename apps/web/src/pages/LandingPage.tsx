import type { WorkflowStepKey } from '@we-build/domain';

import { PageHero, PageSection } from '../components/PageLayout.js';
import { formatTranslation, useI18n } from '../i18n.js';
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
  const { t } = useI18n();

  return (
    <>
      <PageHero
        title={t.landing.title}
        intro={t.landing.intro}
        secondaryIntro={t.landing.secondaryIntro}
        actions={(
          <button
            type="button"
            className="action-button"
            onClick={onStartWorkflow}
            disabled={!stepPages.some((page) => !page.disabled)}
          >
            {t.landing.startWorkflow}
          </button>
        )}
      />

      <PageSection
        id="journey-overview"
        eyebrow={t.landing.journeyEyebrow}
        title={t.landing.journeyTitle}
        copy={t.landing.journeyCopy}
        stacked
      >
        <div className="journey-grid" aria-label={t.landing.journeyGridAria}>
          {stepPages.map((page) => (
            <article key={page.id} className="journey-card">
              <div className="journey-card-head">
                <span className="journey-step-index">{t.landing.stepNumber} {page.stepNumber}</span>
                <h4>{page.label}</h4>
              </div>
              <p className="supporting-copy">{page.description}</p>
              <button
                type="button"
                className="action-button action-button-secondary"
                disabled={page.disabled}
                aria-label={formatTranslation(t.landing.openPageAria, { label: page.label })}
                onClick={() => {
                  if (isWorkflowStepKey(page.id)) {
                    onNavigate(page.id);
                  }
                }}
              >
                {t.landing.openPage} {page.label}
              </button>
            </article>
          ))}
        </div>

      </PageSection>

      <WorkflowSessionSection
        apiBaseUrl={apiBaseUrl}
        vendorOptions={vendorOptions}
        selectedVendor={selectedVendor}
        selectedVendorOption={selectedVendorOption}
        session={session}
        sessionState={sessionState}
        health={health}
        onVendorChange={onVendorChange}
        onStartNewSession={onStartNewSession}
        showReviewPayload={false}
        showWalletSetup
        onSeedWalletCredential={onSeedWalletCredential}
      />
    </>
  );
}