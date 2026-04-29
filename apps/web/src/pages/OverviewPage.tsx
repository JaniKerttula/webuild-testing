import { PageHero, PageSection } from '../components/PageLayout.js';

export function OverviewPage() {
  return (
    <>
      <PageHero
        eyebrow="Overview"
        title="We Build Testing demo workspace"
        intro="This shell is now page-driven: navigation, hero content, and section framing come from reusable components instead of a single hard-coded screen."
        secondaryIntro="The workflow stays intact, and future pages can now be added as page definitions rather than more top-level JSX in the app root."
      />

      <PageSection
        id="overview-architecture"
        eyebrow="Architecture"
        title="Page composition"
        copy="The shell, hero card, and section scaffolding are shared building blocks. Each page now owns only its own content and actions."
        stacked
      >
        <div className="service-grid overview-grid">
          <section className="panel">
            <div className="panel-heading-inline">
              <strong>Reusable shell</strong>
              <span className="vendor-badge">Navigation-ready</span>
            </div>
            <p className="supporting-copy">
              The top navigation is now driven by a page list, so adding a second or third screen does not require touching the shell structure.
            </p>
          </section>

          <section className="panel">
            <div className="panel-heading-inline">
              <strong>Reusable sections</strong>
              <span className="vendor-badge">Content-first</span>
            </div>
            <p className="supporting-copy">
              Shared hero and section wrappers keep the visual structure consistent while allowing each page to compose its own domain-specific panels.
            </p>
          </section>
        </div>
      </PageSection>

      <PageSection
        id="overview-next"
        eyebrow="Next"
        title="Adding pages later"
        copy="To add another screen, define a new page entry and render a page component. The shell and navigation will already support it."
      >
        <section className="panel">
          <ul className="history-list overview-list" aria-label="Navigation roadmap">
            <li>Keep API and session state in the root only when multiple pages need the same data.</li>
            <li>Move page-specific view models into their own page components as new screens appear.</li>
            <li>Add URL-backed routing only when direct linking becomes a requirement, not before.</li>
          </ul>
        </section>
      </PageSection>
    </>
  );
}