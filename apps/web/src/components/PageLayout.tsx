import type { ReactNode } from 'react';

type PageHeroProps = {
  eyebrow?: ReactNode;
  title: string;
  intro: string;
  secondaryIntro?: string;
  actions?: ReactNode;
};

type PageSectionProps = {
  id: string;
  eyebrow: string;
  title: string;
  copy?: string;
  stacked?: boolean;
  children: ReactNode;
};

export function PageHero({ eyebrow, title, intro, secondaryIntro, actions }: PageHeroProps) {
  return (
    <section className="intro-card">
      <div className="intro-card-content">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h2 className="page-title">{title}</h2>
        <p className="intro">{intro}</p>
        {secondaryIntro ? <p className="intro intro-secondary">{secondaryIntro}</p> : null}
        {actions ? <div className="action-row intro-card-actions">{actions}</div> : null}
      </div>
    </section>
  );
}

export function PageSection({ id, eyebrow, title, copy, stacked = false, children }: PageSectionProps) {
  return (
    <section className="main-section" id={id}>
      <div className={`section-intro${stacked ? ' section-intro-stack' : ''}`}>
        <div>
          <p className="panel-label">{eyebrow}</p>
          <h3 className="section-title">{title}</h3>
        </div>
        {copy ? <p className="section-copy">{copy}</p> : null}
      </div>
      {children}
    </section>
  );
}