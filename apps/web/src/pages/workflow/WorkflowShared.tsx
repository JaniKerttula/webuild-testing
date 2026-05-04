import type { WalletCredentialSummary } from '@we-build/domain';

import { DetailList, PanelHeader } from '../../components/PageLayout.js';
import { QrCodePanel } from '../../components/QrCodePanel.js';
import { formatTranslation, getIntlLocale, useI18n } from '../../i18n.js';
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

export function formatTimestamp(value?: string, locale: 'fi' | 'en' = 'fi', fallbackLabel = 'Not available'): string {
  if (!value) {
    return fallbackLabel;
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
      <PanelHeader title={title} badge={badge} />
      <p className="supporting-copy">{description}</p>
      <div className="pid-offer-grid">
        <QrCodePanel value={qrValue} alt={qrAlt} />
        <div className="pid-offer-details">
          <DetailList
            compact
            className="wallet-offer-meta"
            items={metadata.map((item) => ({
              key: item.label,
              label: item.label,
              value: item.value,
            }))}
          />
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
          <DetailList
            compact
            className="wallet-offer-meta"
            items={[
              { key: 'exchange-id', label: t.fields.exchangeId, value: exchangeId },
              { key: 'request-uri', label: t.fields.requestUri, value: requestUri },
              { key: 'presentation-definition', label: t.fields.presentationDefinition, value: presentationDefinitionId },
            ]}
          />
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
          <p className="supporting-copy wallet-offer-copy">{t.wallets.offerCopy}</p>
          <div className="pid-offer-grid">
            <QrCodePanel value={credential.offer.qrCodeValue} alt={formatTranslation(t.wallets.offerQrAlt, { label: credential.label })} />
            <div className="pid-offer-details">
              <DetailList
                compact
                className="wallet-offer-meta"
                items={[
                  { key: 'exchange-id', label: t.fields.exchangeId, value: credential.offer.exchangeId ?? t.common.pending },
                  { key: 'pin', label: t.fields.pin, value: credential.offer.userPin ?? t.common.notRequired },
                ]}
              />
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