import { createContext, useContext, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import type {
  AdapterSimulationMode,
  SessionActionKey,
  VendorId,
  WalletCredentialType,
  WalletInteractionMode,
  WalletRole,
  WorkflowStepKey,
  WorkflowStepStatus,
} from '@we-build/domain';

import enRaw from './locales/en.json';
import fiRaw from './locales/fi.json';

export type AppLocale = 'fi' | 'en';

export type TranslationSet = {
  shell: {
    brandTitle: string;
    languageSwitcherLabel: string;
    footerLinks: {
      dataProtection: string;
      accessibility: string;
      contactInformation: string;
    };
  };
  common: {
    loading: string;
    retry: string;
    cancel: string;
    fail: string;
    continueToNextStep: string;
    notAvailable: string;
    pending: string;
    dynamic: string;
    notRequired: string;
    notLoadedYet: string;
    notAssignedYet: string;
    noEventsYet: string;
    noCredentialsLoaded: string;
    generatingQrCode: string;
    showRawQrInput: string;
    openRequestUri: string;
    openWalletDeepLink: string;
    openIssuerDeepLink: string;
    openRawOfferUrl: string;
    loadingVendor: string;
    loadingVendorDefinitions: string;
    notLoaded: string;
    localShellActive: string;
  };
  navigation: {
    landing: string;
    workflowBreadcrumbAria: string;
    breadcrumbButtonAria: string;
    stepLabels: Record<WorkflowStepKey, string>;
    stepDescriptions: Record<WorkflowStepKey, string>;
  };
  statuses: {
    workflow: Record<WorkflowStepStatus, string>;
    notes: Record<WorkflowStepStatus, string>;
  };
  actions: Record<SessionActionKey | 'restartVatIssuance', string>;
  wallets: {
    interactionLabels: Record<WalletInteractionMode, string>;
    credentialStatusLabels: Record<'seeded' | 'offer-created' | 'issued', string>;
    walletRoleLabels: Record<WalletRole, string>;
    credentialTypeLabels: Record<WalletCredentialType, string>;
    offerCopy: string;
    offerQrAlt: string;
    seedOptions: Array<{
      credentialType: WalletCredentialType;
      label: string;
    }>;
  };
  vendors: Record<VendorId, { label: string; description: string; badge: string }>;
  landing: {
    title: string;
    intro: string;
    secondaryIntro: string;
    startWorkflow: string;
    journeyEyebrow: string;
    journeyTitle: string;
    journeyCopy: string;
    journeyGridAria: string;
    stepNumber: string;
    stepDescription: string;
    openPage: string;
    openPageAria: string;
  };
  successPage: {
    title: string;
    description: string;
    returnToStart: string;
  };
  runtime: {
    simulationModes: Record<AdapterSimulationMode, string>;
    sessionNotLoaded: string;
    checkingApiHealth: string;
    loadingSession: string;
    loadedSession: string;
    unknownSessionLoadingError: string;
    creatingSession: string;
    createdSession: string;
    unknownSessionCreationError: string;
    runningAction: string;
    retryingAction: string;
    actionCompleted: string;
    unknownActionExecutionError: string;
    unknownStepResetError: string;
    restartingAction: string;
    resetBeforeRestart: string;
    unknownStepRestartError: string;
    credentialReceived: Record<'pid' | 'poa' | 'eucc', string>;
    credentialVerificationFailed: Record<'pid' | 'poa' | 'eucc', string>;
    unknownPollingError: Record<'pid' | 'poa' | 'eucc' | 'vatIssuance', string>;
    vatIssued: string;
    vatIssuanceFailed: string;
    seedingWallet: string;
    walletOfferCreated: string;
    walletSeeded: string;
    unknownWalletSeedingError: string;
    healthResponding: string;
    unknownHealthCheckError: string;
    unknownVendorLoadingError: string;
  };
  workflowStep: {
    requestHeading: Record<'pid' | 'poa' | 'eucc', string>;
    requestDescription: Record<'pid' | 'poa' | 'eucc', string>;
    requestQrAlt: Record<'pid' | 'poa' | 'eucc', string>;
    cancelMessage: Record<'pid' | 'poa' | 'eucc', string>;
    reRequestLabel: Record<'pid' | 'poa' | 'eucc', string>;
    heroIntro: Record<WorkflowStepKey, string>;
    heroSecondaryIntro: string;
    currentContext: string;
    currentContextFields: {
      vendor: string;
      sessionId: string;
      lifecycle: string;
      walletLane: string;
      apiHealth: string;
      sessionApi: string;
    };
    issuanceDetails: string;
    issuanceFields: {
      vatId: string;
      exchangeId: string;
      administrativeUnit: string;
      issuer: string;
      country: string;
      issuedAt: string;
      organisation: string;
      status: string;
    };
    submitVatIssuance: string;
    currentStepFailed: string;
  };
  review: {
    person: string;
    company: string;
    poa: string;
    eucc: string;
    matchedVatAttestation: string;
    assembledAt: string;
    matchedHint: string;
    automaticHint: string;
  };
  fields: {
    fullName: string;
    name: string;
    dateOfBirth: string;
    issuer: string;
    issuerWithPrefix: string;
    attorney: string;
    principal: string;
    scope: string;
    company: string;
    legalForm: string;
    memberState: string;
    nationality: string;
    companyId: string;
    jurisdiction: string;
    registeredAddress: string;
    representatives: string;
    economicOperator: string;
    operatorId: string;
    holder: string;
    credential: string;
    exchangeId: string;
    requestUri: string;
    presentationDefinition: string;
    pin: string;
  };
  sessionSection: {
    eyebrow: string;
    title: string;
    copy: string;
    vendorProfile: string;
    vendorLabel: string;
    serviceStatus: string;
    frontend: string;
    apiHealth: string;
    apiBaseUrl: string;
    sessionApi: string;
    sessionId: string;
    startNewSession: string;
    testCredentials: string;
    walletCredentials: string;
    testCredentialCopy: {
      externalWallets: string;
      localWallets: string;
      noWalletSeeding: string;
    };
    pidIssuerConnection: string;
    pidIssuerDescription: string;
    pidIssuerQrAlt: string;
    personalWallet: string;
    companyWallet: string;
    reviewPayload: string;
    reviewPayloadSummary: string;
    reviewPayloadEmpty: string;
    operatorStep: string;
    submissionResult: string;
    issuanceResult: string;
    issuanceResultSummary: string;
    issuanceResultEmpty: string;
    refreshIssuanceStatus: string;
    sessionOverview: string;
    sessionOverviewCopy1: string;
    sessionOverviewCopy2: string;
    reviewPayloadCardsAria: string;
  };
  history: {
    eyebrow: string;
    title: string;
    listAria: string;
  };
  evidence: {
    stepCopy: Record<'pid' | 'poa' | 'eucc', {
      eyebrow: string;
      title: string;
      copy: string;
      panelTitle: string;
      laneBadge: string;
      emptyCopy: string;
    }>;
    requestTitle: Record<'pid' | 'poa' | 'eucc', string>;
    requestDescription: Record<'pid' | 'poa' | 'eucc', string>;
    qrAlt: Record<'pid' | 'poa' | 'eucc', string>;
    prerequisiteState: string;
    dependencyMap: string;
    prerequisiteListAria: string;
    dataOrigin: string;
    dataOriginCopy: {
      mockLocal: string;
      external: string;
    };
    mockFixture: string;
    requestCardCopy: Record<'pid' | 'poa' | 'eucc', string>;
    prerequisiteWaiting: {
      pid: string;
      poa: string;
      eucc: string;
      requestCreated: string;
    };
    currentStepFailed: string;
  };
  workflowLegacy: {
    pageHero: {
      eyebrow: string;
      title: string;
      intro: string;
      secondaryIntro: string;
    };
    stepsSection: {
      eyebrow: string;
      title: string;
      listAria: string;
      emptyTitle: string;
      emptyBadge: string;
      emptySummary: string;
      emptyNote: string;
      emptyMeta: string;
    };
    walletSetup: {
      eyebrow: string;
      title: string;
      modeTitle: string;
      setupActions: string;
    };
  };
};

const translations: Record<AppLocale, TranslationSet> = {
  fi: fiRaw as TranslationSet,
  en: enRaw as TranslationSet,
};

type I18nContextValue = {
  locale: AppLocale;
  setLocale: Dispatch<SetStateAction<AppLocale>>;
  t: TranslationSet;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export const localeStorageKey = 'we-build-testing:locale';

export function getInitialLocale(): AppLocale {
  if (typeof window === 'undefined') {
    return 'en';
  }

  const storedLocale = window.localStorage.getItem(localeStorageKey);

  if (storedLocale === 'fi' || storedLocale === 'en') {
    return storedLocale;
  }

  return window.navigator.language.toLowerCase().startsWith('fi') ? 'fi' : 'en';
}

export function getIntlLocale(locale: AppLocale): string {
  return locale === 'fi' ? 'fi-FI' : 'en-GB';
}

export function getTranslations(locale: AppLocale): TranslationSet {
  return translations[locale];
}

export function formatTranslation(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, value),
    template,
  );
}

export function I18nProvider({
  locale,
  setLocale,
  children,
}: {
  locale: AppLocale;
  setLocale: Dispatch<SetStateAction<AppLocale>>;
  children: ReactNode;
}) {
  return (
    <I18nContext.Provider value={{ locale, setLocale, t: translations[locale] }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);

  if (!context) {
    throw new Error('useI18n must be used within I18nProvider');
  }

  return context;
}

export function getVendorDisplay(locale: AppLocale, vendorId: VendorId): { label: string; description: string; badge: string } {
  return translations[locale].vendors[vendorId];
}
