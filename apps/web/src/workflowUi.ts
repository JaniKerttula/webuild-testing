import type { SeedableWalletRole, SessionActionKey, WalletCredentialType } from '@we-build/domain';

export const statusNotes = {
  ready: 'This step is available in the current normalized session state.',
  blocked: 'This step is intentionally gated by upstream workflow dependencies.',
  pending: 'This step would currently be waiting for a vendor or session API response.',
  succeeded: 'This step has normalized data ready for downstream screens.',
  failed: 'This step would expose a normalized error and a retry path.',
  'not-started': 'This step exists in the model but has not been activated yet.',
} as const;

export const actionLabels: Record<SessionActionKey | 'issuanceStatus', string> = {
  pid: 'Request PID',
  poa: 'Request PoA',
  eucc: 'Request EUCC',
  review: 'Assemble review',
  vatIssuance: 'Start issuance',
  issuanceStatus: 'Check issuance',
};

export const walletSeedOptions: Array<{
  walletRole: SeedableWalletRole;
  credentialType: WalletCredentialType;
  label: string;
}> = [
  { walletRole: 'personal', credentialType: 'pid', label: 'Seed PID to personal wallet' },
  { walletRole: 'personal', credentialType: 'poa', label: 'Seed PoA to personal wallet' },
  { walletRole: 'company', credentialType: 'eucc', label: 'Seed EUCC to company wallet' },
];

export const walletInteractionLabels = {
  'local-mock-wallet': 'Local mock wallet in this app',
  'external-wallet-app': 'External wallet app',
} as const;

export const walletCredentialStatusLabels = {
  seeded: 'Seeded locally',
  'offer-created': 'OID4VCI offer ready',
  issued: 'Issued to wallet',
} as const;