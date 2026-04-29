import type {
  SeedableWalletRole,
  SessionActionKey,
  WalletCredentialType,
  WalletInteractionMode,
  WorkflowStepStatus,
} from '@we-build/domain';

import { getTranslations, type AppLocale } from './i18n.js';

export function getStatusNotes(locale: AppLocale): Record<WorkflowStepStatus, string> {
  return getTranslations(locale).statuses.notes;
}

export function getActionLabels(locale: AppLocale): Record<SessionActionKey, string> {
  return getTranslations(locale).actions;
}

export function getWalletSeedOptions(locale: AppLocale): Array<{
  walletRole: SeedableWalletRole;
  credentialType: WalletCredentialType;
  label: string;
}> {
  const { wallets } = getTranslations(locale);

  return [
    { walletRole: 'personal', credentialType: 'pid', label: wallets.seedOptions[0].label },
    { walletRole: 'personal', credentialType: 'poa', label: wallets.seedOptions[1].label },
    { walletRole: 'company', credentialType: 'eucc', label: wallets.seedOptions[2].label },
  ];
}

export function getWalletInteractionLabels(locale: AppLocale): Record<WalletInteractionMode, string> {
  return getTranslations(locale).wallets.interactionLabels;
}

export function getWalletCredentialStatusLabels(locale: AppLocale): Record<'seeded' | 'offer-created' | 'issued', string> {
  return getTranslations(locale).wallets.credentialStatusLabels;
}

export function getWorkflowStatusLabels(locale: AppLocale): Record<WorkflowStepStatus, string> {
  return getTranslations(locale).statuses.workflow;
}