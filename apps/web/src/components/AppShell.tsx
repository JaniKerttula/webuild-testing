import type { ReactNode } from 'react';

export type NavigationItem = {
  id: string;
  label: string;
  disabled?: boolean;
};

type LanguageLink = {
  href: string;
  label: string;
  isCurrent?: boolean;
};

type FooterLink = {
  href: string;
  label: string;
};

type AppShellProps = {
  brandTitle: string;
  onBrandClick: () => void;
  languageLinks: LanguageLink[];
  footerLinks: FooterLink[];
  children: ReactNode;
};

export function AppShell({
  brandTitle,
  onBrandClick,
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
              <h1 className="brand-title">{brandTitle}</h1>
            </button>
          </div>

          <div className="header-actions" aria-label="Language switcher">
            {languageLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className={`language-link${link.isCurrent ? ' current-language' : ''}`}
                aria-current={link.isCurrent ? 'page' : undefined}
              >
                {link.label}
              </a>
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