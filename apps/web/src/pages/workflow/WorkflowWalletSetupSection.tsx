import type { OrchestrationSession, VendorDefinition } from '@we-build/domain';

import { PageSection } from '../../components/PageLayout.js';
import { walletSeedOptions } from '../../workflowUi.js';
import { WalletCredentialCard, WorkflowQrPanel } from './WorkflowShared.js';
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
  const allowsWalletSeeding = Boolean(selectedVendorOption?.capabilities.mockWalletSeeding);
  const showsWalletState = selectedVendorOption?.id === 'mock-local';
  const usesExternalWallets = selectedVendorOption?.walletInteraction.personal === 'external-wallet-app'
    || selectedVendorOption?.walletInteraction.company === 'external-wallet-app';
  const personalPidOffer = session?.wallets.personal.loadedCredentials.find(
    (credential) => credential.credentialType === 'pid' && credential.offer,
  );

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

      {personalPidOffer?.offer ? (
        <WorkflowQrPanel
          title="PID issuer connection"
          badge="OID4VCI"
          description="Use this QR code or deep-link to open the wallet and accept the PID credential offer from the issuer."
          qrValue={personalPidOffer.offer.qrCodeValue}
          qrAlt="PID issuer connection QR code"
          metadata={[
            { label: 'Credential', value: personalPidOffer.label },
            { label: 'Holder', value: personalPidOffer.holderName },
            { label: 'Exchange ID', value: personalPidOffer.offer.exchangeId ?? 'Pending' },
            { label: 'PIN', value: personalPidOffer.offer.userPin ?? 'Not required' },
          ]}
          primaryAction={{ href: personalPidOffer.offer.offerUri, label: 'Open issuer deep-link' }}
          secondaryAction={personalPidOffer.offer.referenceUri
            ? { href: personalPidOffer.offer.referenceUri, label: 'Open raw offer URL' }
            : undefined}
        />
      ) : null}

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
          <>
            <section className="panel">
              <p className="panel-label">Personal wallet</p>
              <ul className="wallet-list">
                {session?.wallets.personal.loadedCredentials.length ? session.wallets.personal.loadedCredentials.map((credential) => (
                  <WalletCredentialCard key={`personal-${credential.credentialType}`} credential={credential} />
                )) : <li>No credentials loaded.</li>}
              </ul>
            </section>

            <section className="panel">
              <p className="panel-label">Company wallet</p>
              <ul className="wallet-list">
                {session?.wallets.company.loadedCredentials.length ? session.wallets.company.loadedCredentials.map((credential) => (
                  <WalletCredentialCard key={`company-${credential.credentialType}`} credential={credential} />
                )) : <li>No credentials loaded.</li>}
              </ul>
            </section>
          </>
        ) : null}
      </div>
    </PageSection>
  );
}