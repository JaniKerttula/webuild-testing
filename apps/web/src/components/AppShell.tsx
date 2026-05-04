import type { ReactNode } from 'react';

const brandMarkUrl = '/resources/images/we-build-logomark-light-bg.png';

type LanguageLink = {
  id: string;
  label: string;
  isCurrent?: boolean;
  onSelect: () => void;
};

type FooterLink = {
  href: string;
  label: string;
};

type AppShellProps = {
  brandTitle: string;
  onBrandClick: () => void;
  languageSwitcherLabel: string;
  languageLinks: LanguageLink[];
  footerLinks: FooterLink[];
  children: ReactNode;
};

export function AppShell({
  brandTitle,
  onBrandClick,
  languageSwitcherLabel,
  languageLinks,
  footerLinks,
  children,
}: AppShellProps) {
  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="site-header-inner">
          <div className="brand-lockup">
            <button type="button" className="brand-title-button" onClick={onBrandClick}>
              <h1 className="brand-title">
                <img className="brand-title-icon" src={brandMarkUrl} alt="" aria-hidden="true" />
                <span>{brandTitle}</span>
              </h1>
            </button>
          </div>

          <div className="header-actions" aria-label={languageSwitcherLabel}>
            {languageLinks.map((link) => (
              <button
                key={link.id}
                type="button"
                className={`language-link${link.isCurrent ? ' current-language' : ''}`}
                aria-current={link.isCurrent ? 'page' : undefined}
                onClick={link.onSelect}
              >
                {link.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="page-main">
        <article className="page-content">{children}</article>
      </main>

      <footer className="site-footer" id="page-footer">
        <div className="site-footer-inner">
          {footerLinks.map((link, index) => (
            <span key={link.label} className="site-footer-link-group">
              {index > 0 ? <span aria-hidden="true">|</span> : null}
              <a href={link.href}>{link.label}</a>
            </span>
          ))}
        </div>
      </footer>
    </div>
  );
}