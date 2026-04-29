import type { OrchestrationSession, VendorDefinition } from '@we-build/domain';

import { PageSection } from '../../components/PageLayout.js';
import { useI18n } from '../../i18n.js';
import { getWalletSeedOptions } from '../../workflowUi.js';
import { WalletCredentialCard } from './WorkflowShared.js';
import type { WorkflowPageProps } from './types.js';

type WorkflowWalletSetupSectionProps = {
  session: OrchestrationSession | null;
  selectedVendorOption?: VendorDefinition;
  onSeedWalletCredential: WorkflowPageProps['onSeedWalletCredential'];
};

export function WorkflowWalletSetupSection({
  session,
  selectedVendorOption,
  onSeedWalletCredential,
}: WorkflowWalletSetupSectionProps) {
  const { locale, t } = useI18n();
  const walletSeedOptions = getWalletSeedOptions(locale);
  const allowsWalletSeeding = Boolean(selectedVendorOption?.capabilities.mockWalletSeeding);
  const showsWalletState = Boolean(
    session?.wallets.personal.loadedCredentials.length
    || session?.wallets.company.loadedCredentials.length
    || selectedVendorOption?.id === 'mock-local',
  );
  const walletCredentials = [
    ...(session?.wallets.personal.loadedCredentials ?? []),
    ...(session?.wallets.company.loadedCredentials ?? []),
  ];
  const usesExternalWallets = selectedVendorOption?.walletInteraction.personal === 'external-wallet-app'
    || selectedVendorOption?.walletInteraction.company === 'external-wallet-app';

  return (
    <PageSection id="wallet-setup" eyebrow="Wallet setup" title="Preload test wallets">
      <div className="message-box">
        <strong>Wallet testing mode</strong>
        <p>
          {allowsWalletSeeding
            ? usesExternalWallets
              ? 'This vendor issues the mock credentials through the real vendor flow. Each seed action creates an OID4VCI offer that can be opened in a real wallet by scanning the QR code below.'
              : 'This vendor supports local mock credential seeding, so test wallets can be preloaded before running vendor-backed steps.'
            : 'This vendor does not expose local mock credential seeding. Normalized results must come back through vendor adapter actions.'}
        </p>
      </div>

      <div className="wallet-grid">
        <section className="panel">
          <p className="panel-label">Setup actions</p>
          <div className="step-actions">
            {walletSeedOptions.map((option) => (
              <button
                key={`${option.walletRole}-${option.credentialType}`}
                type="button"
                className="action-button"
                onClick={() => onSeedWalletCredential(option.walletRole, option.credentialType)}
                disabled={!session || !allowsWalletSeeding}
              >
                {option.label}
              </button>
            ))}
          </div>
        </section>

        {showsWalletState ? (
          <section className="panel">
            <p className="panel-label">{t.sessionSection.walletCredentials}</p>
            <ul className="wallet-list">
              {walletCredentials.length ? walletCredentials.map((credential) => (
                <WalletCredentialCard key={`${credential.credentialType}-${credential.seededAt}`} credential={credential} />
              )) : <li>{t.common.noCredentialsLoaded}</li>}
            </ul>
          </section>
        ) : null}
      </div>
    </PageSection>
  );
}