import type { WalletCredentialSummary } from '@we-build/domain';

import { QrCodePanel } from '../../QrCodePanel.js';
import { walletCredentialStatusLabels } from '../../workflowUi.js';

type WorkflowQrPanelProps = {
  title: string;
  badge: string;
  description: string;
  qrValue: string;
  qrAlt: string;
  metadata: Array<{ label: string; value: string }>;
  primaryAction: { href: string; label: string };
  secondaryAction?: { href: string; label: string };
};

export function formatTimestamp(value?: string): string {
  if (!value) {
    return 'Not available';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('fi-FI', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function WorkflowQrPanel({
  title,
  badge,
  description,
  qrValue,
  qrAlt,
  metadata,
  primaryAction,
  secondaryAction,
}: WorkflowQrPanelProps) {
  return (
    <section className="panel pid-offer-panel">
      <div className="panel-heading-inline">
        <strong>{title}</strong>
        <span className="vendor-badge">{badge}</span>
      </div>
      <p className="supporting-copy">{description}</p>
      <div className="pid-offer-grid">
        <QrCodePanel value={qrValue} alt={qrAlt} />
        <div className="pid-offer-details">
          <dl className="review-list compact-review-list wallet-offer-meta">
            {metadata.map((item) => (
              <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>
            ))}
          </dl>
          <div className="wallet-offer-actions">
            <a className="primary-action-link" href={primaryAction.href}>
              {primaryAction.label}
            </a>
            {secondaryAction ? (
              <a className="secondary-action-link" href={secondaryAction.href} target="_blank" rel="noreferrer">
                {secondaryAction.label}
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

export function WalletCredentialCard({ credential }: { credential: WalletCredentialSummary }) {
  return (
    <li className="wallet-credential-card">
      <div className="wallet-credential-header">
        <strong>{credential.label}</strong>
        <span className="step-state">{walletCredentialStatusLabels[credential.status]}</span>
      </div>
      <span>{credential.holderName}</span>
      {credential.issuerName ? <span className="supporting-copy">Issuer: {credential.issuerName}</span> : null}

      {credential.offer ? (
        <div className="wallet-offer-panel">
          <p className="supporting-copy wallet-offer-copy">
            Scan the QR code with a compatible wallet or open the OID4VCI deep link directly.
          </p>
          <QrCodePanel value={credential.offer.qrCodeValue} alt={`${credential.label} OID4VCI offer`} />
          <dl className="review-list compact-review-list wallet-offer-meta">
            <div><dt>Exchange ID</dt><dd>{credential.offer.exchangeId ?? 'Pending'}</dd></div>
            <div><dt>PIN</dt><dd>{credential.offer.userPin ?? 'Not required'}</dd></div>
          </dl>
          <div className="wallet-offer-actions">
            <a className="primary-action-link" href={credential.offer.offerUri}>
              Open OID4VCI offer
            </a>
            {credential.offer.referenceUri ? (
              <a className="secondary-action-link" href={credential.offer.referenceUri} target="_blank" rel="noreferrer">
                Open raw offer URL
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
    </li>
  );
}