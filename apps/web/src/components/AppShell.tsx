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
  navigationItems: NavigationItem[];
  currentPageId: string;
  onNavigate: (pageId: string) => void;
  languageLinks: LanguageLink[];
  footerLinks: FooterLink[];
  children: ReactNode;
};

export function AppShell({
  brandTitle,
  navigationItems,
  currentPageId,
  onNavigate,
  languageLinks,
  footerLinks,
  children,
}: AppShellProps) {
  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="site-header-inner">
          <div className="brand-lockup">
            <h1 className="brand-title">{brandTitle}</h1>
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

      <nav className="top-navigation" aria-label="Primary">
        <div className="top-navigation-inner">
          {navigationItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`top-navigation-button${item.id === currentPageId ? ' current-section' : ''}`}
              aria-current={item.id === currentPageId ? 'page' : undefined}
              disabled={item.disabled}
              onClick={() => onNavigate(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </nav>

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