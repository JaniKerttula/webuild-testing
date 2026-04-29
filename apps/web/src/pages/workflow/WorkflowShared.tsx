import type { WalletCredentialSummary } from '@we-build/domain';

import { QrCodePanel } from '../../QrCodePanel.js';
import { getIntlLocale, useI18n } from '../../i18n.js';
import { getWalletCredentialStatusLabels } from '../../workflowUi.js';

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

type WorkflowQrEvidenceCardProps = {
  copy: string;
  qrValue: string;
  qrAlt: string;
  exchangeId: string;
  requestUri: string;
  presentationDefinitionId: string;
  deepLink: string;
  className?: string;
};

export function formatTimestamp(value?: string, locale: 'fi' | 'en' = 'fi'): string {
  if (!value) {
    return locale === 'fi' ? 'Ei saatavilla' : 'Not available';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(getIntlLocale(locale), {
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
  const { t } = useI18n();

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

export function WorkflowQrEvidenceCard({
  copy,
  qrValue,
  qrAlt,
  exchangeId,
  requestUri,
  presentationDefinitionId,
  deepLink,
  className,
}: WorkflowQrEvidenceCardProps) {
  const { t } = useI18n();

  return (
    <div className={className ? `wallet-offer-panel ${className}` : 'wallet-offer-panel'}>
      <p className="supporting-copy wallet-offer-copy">{copy}</p>
      <div className="pid-offer-grid">
        <QrCodePanel value={qrValue} alt={qrAlt} />
        <div className="pid-offer-details">
          <dl className="review-list compact-review-list wallet-offer-meta">
            <div><dt>{t.fields.exchangeId}</dt><dd>{exchangeId}</dd></div>
            <div><dt>{t.fields.requestUri}</dt><dd>{requestUri}</dd></div>
            <div><dt>{t.fields.presentationDefinition}</dt><dd>{presentationDefinitionId}</dd></div>
          </dl>
          <div className="wallet-offer-actions">
            <a className="primary-action-link" href={deepLink}>
              {t.common.openWalletDeepLink}
            </a>
            <a className="secondary-action-link" href={requestUri} target="_blank" rel="noreferrer">
              {t.common.openRequestUri}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export function WalletCredentialCard({ credential }: { credential: WalletCredentialSummary }) {
  const { locale, t } = useI18n();
  const walletCredentialStatusLabels = getWalletCredentialStatusLabels(locale);

  return (
    <li className="wallet-credential-card">
      <div className="wallet-credential-header">
        <strong>{credential.label}</strong>
        <span className="step-state">{walletCredentialStatusLabels[credential.status]}</span>
      </div>
      <span>{credential.holderName}</span>
      {credential.issuerName ? <span className="supporting-copy">{t.fields.issuerWithPrefix}: {credential.issuerName}</span> : null}

      {credential.offer ? (
        <div className="wallet-offer-panel">
          <p className="supporting-copy wallet-offer-copy">
            {locale === 'fi'
              ? 'Skannaa QR-koodi yhteensopivalla lompakolla tai avaa OID4VCI-syvälinkki suoraan.'
              : 'Scan the QR code with a compatible wallet or open the OID4VCI deep link directly.'}
          </p>
          <div className="pid-offer-grid">
            <QrCodePanel value={credential.offer.qrCodeValue} alt={`${credential.label} OID4VCI offer`} />
            <div className="pid-offer-details">
              <dl className="review-list compact-review-list wallet-offer-meta">
                <div><dt>{t.fields.exchangeId}</dt><dd>{credential.offer.exchangeId ?? t.common.pending}</dd></div>
                <div><dt>{t.fields.pin}</dt><dd>{credential.offer.userPin ?? t.common.notRequired}</dd></div>
              </dl>
              <div className="wallet-offer-actions">
                <a className="primary-action-link" href={credential.offer.offerUri}>
                  {t.common.openIssuerDeepLink}
                </a>
                {credential.offer.referenceUri ? (
                  <a className="secondary-action-link" href={credential.offer.referenceUri} target="_blank" rel="noreferrer">
                    {t.common.openRawOfferUrl}
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </li>
  );
}