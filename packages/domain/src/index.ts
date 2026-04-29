export type VendorId = 'mock-local' | 'igrant-sandbox';

export type WalletRole = 'personal' | 'company' | 'operator';

export type SeedableWalletRole = 'personal' | 'company';

export type WalletCredentialType = 'pid' | 'poa' | 'eucc' | 'vat';

export type WorkflowStepKey =
  | 'pid'
  | 'poa'
  | 'eucc'
  | 'review'
  | 'vatIssuance';

export type WorkflowStepStatus =
  | 'not-started'
  | 'ready'
  | 'blocked'
  | 'pending'
  | 'succeeded'
  | 'failed';

export type SessionLifecycleStatus =
  | 'draft'
  | 'in-progress'
  | 'ready-for-review'
  | 'submitting'
  | 'completed'
  | 'failed';

export type ErrorSource = 'client' | 'session-api' | 'vendor-adapter';

export type AdapterSimulationMode = 'success' | 'failure' | 'pending';

export type WalletInteractionMode = 'local-mock-wallet' | 'external-wallet-app';

export type VendorCapabilities = {
  mockWalletSeeding: boolean;
  personalWalletPid: boolean;
  personalWalletPoa: boolean;
  companyWalletEucc: boolean;
  reviewAssembly: boolean;
  vatIssuance: boolean;
  issuanceTracking: boolean;
};

export type VendorDefinition = {
  id: VendorId;
  label: string;
  description: string;
  badge: string;
  walletInteraction: {
    personal: WalletInteractionMode;
    company: WalletInteractionMode;
  };
  capabilities: VendorCapabilities;
};

export type NormalizedError = {
  code: string;
  message: string;
  retryable: boolean;
  source: ErrorSource;
  detail?: string;
};

export type CompanyContext = {
  companyId: string;
  companyName: string;
  legalForm: string;
  jurisdiction: string;
  registerName?: string;
  registeredOffice?: string;
};

export type PidRecord = {
  givenName: string;
  familyName: string;
  fullName: string;
  dateOfBirth: string;
  nationality: string;
  residentCountry: string;
  ageOver18: boolean;
  issuerName: string;
  issuerId: string;
  issuedAt: string;
  expiresAt: string;
};

export type WalletPresentationRequest = {
  protocol: 'oidc4vp';
  requestUri: string;
  openId4VpUri: string;
  qrCodeValue: string;
  exchangeId?: string;
  presentationDefinitionId?: string;
};

export type PidStepData = {
  record?: PidRecord;
  request?: WalletPresentationRequest;
};

export type PoaStepData = {
  record?: PoaRecord;
  request?: WalletPresentationRequest;
};

export type PoaRecord = {
  companyId: string;
  companyName: string;
  principalName: string;
  attorneyName: string;
  attorneyDateOfBirth?: string;
  scope: string[];
  substitutionAllowed: boolean;
  validFrom: string;
  validUntil: string;
  lawJurisdiction: string;
  signingPlace: string;
  signingDate: string;
};

export type EuccRecord = {
  companyId: string;
  companyName: string;
  legalForm: string;
  registrationMemberState: string;
  registeredAddress: string;
  registrationDate: string;
  legalPersonStatus: string;
  activityCodes: string[];
  contactEmail?: string;
  contactPage?: string;
  representativeNames: string[];
};

export type EuccStepData = {
  record?: EuccRecord;
  request?: WalletPresentationRequest;
};

export type ReviewPayload = {
  person: PidRecord;
  company: CompanyContext;
  poa: PoaRecord;
  eucc: EuccRecord;
  vatAttestation: VatAttestationRecord;
  assembledAt: string;
};

export type VatAttestationRecord = {
  vatId: string;
  administrativeUnitName: string;
  administrativeUnitType: string;
  economicOperatorId: string;
  economicOperatorName: string;
  issuingCountry: string;
  issuingOrganisation: string;
  attestationIssuingOrganisation?: string;
  issuedAt: string;
};

export type VatIssuanceOutcome = 'not-started' | 'pending' | 'issued' | 'failed';

export type VatIssuanceResult = {
  vatId: string;
  administrativeUnitName: string;
  administrativeUnitType: string;
  issuingCountry: string;
  issuingOrganisation: string;
  exchangeId?: string;
  issuedAt?: string;
  status: VatIssuanceOutcome;
  walletCredential?: WalletCredentialSummary;
};

export type WorkflowStep<T> = {
  key: WorkflowStepKey;
  status: WorkflowStepStatus;
  walletRole: WalletRole;
  data?: T;
  error?: NormalizedError;
  updatedAt?: string;
};

export type WorkflowEvent = {
  step: WorkflowStepKey;
  status: WorkflowStepStatus;
  timestamp: string;
  message: string;
};

export type WalletCredentialStatus = 'seeded' | 'offer-created' | 'issued';

export type WalletCredentialOffer = {
  protocol: 'oid4vci';
  offerUri: string;
  qrCodeValue: string;
  referenceUri?: string;
  exchangeId?: string;
  userPin?: string;
};

export type WalletCredentialSummary = {
  credentialType: WalletCredentialType;
  label: string;
  holderName: string;
  issuerName?: string;
  seededAt: string;
  status: WalletCredentialStatus;
  offer?: WalletCredentialOffer;
};

export type WalletState = {
  walletRole: SeedableWalletRole;
  loadedCredentials: WalletCredentialSummary[];
};

export type SessionStepDataMap = {
  pid: PidStepData;
  poa: PoaStepData;
  eucc: EuccStepData;
  review: ReviewPayload;
  vatIssuance: VatIssuanceResult;
};

export type OrchestrationSession = {
  sessionId: string;
  vendorId: VendorId;
  lifecycle: SessionLifecycleStatus;
  createdAt: string;
  updatedAt: string;
  wallets: {
    personal: WalletState;
    company: WalletState;
  };
  companyContext?: CompanyContext;
  pid: WorkflowStep<PidStepData>;
  poa: WorkflowStep<PoaStepData>;
  eucc: WorkflowStep<EuccStepData>;
  review: WorkflowStep<ReviewPayload>;
  vatIssuance: WorkflowStep<VatIssuanceResult>;
  lastError?: NormalizedError;
  eventLog: WorkflowEvent[];
};

export type WorkflowStepDefinition = {
  key: WorkflowStepKey;
  title: string;
  summary: string;
  walletRole: WalletRole;
  dependsOn: WorkflowStepKey[];
};

export type WorkflowStepSnapshot = WorkflowStepDefinition & {
  status: WorkflowStepStatus;
  data?:
    | PidStepData
    | CompanyContext
    | PoaStepData
    | EuccStepData
    | ReviewPayload
    | VatIssuanceResult;
  error?: NormalizedError;
  updatedAt?: string;
};

export type CreateSessionRequest = {
  vendorId: VendorId;
};

export type SessionActionKey = WorkflowStepKey | 'issuanceStatus';

export type TriggerSessionActionRequest = {
  simulationMode?: AdapterSimulationMode;
};

export type SeedWalletCredentialRequest = {
  credentialType: WalletCredentialType;
};

export type UpdateSessionStepRequest<K extends WorkflowStepKey = WorkflowStepKey> = {
  step: K;
  status: WorkflowStepStatus;
  data?: SessionStepDataMap[K];
  error?: NormalizedError;
  message?: string;
  updatedAt?: string;
};

export const vendorCatalog: VendorDefinition[] = [
  {
    id: 'mock-local',
    label: 'Local Mock Vendor',
    description: 'Local mock flow that keeps all steps self-contained on localhost.',
    badge: 'Local demo',
    walletInteraction: {
      personal: 'local-mock-wallet',
      company: 'local-mock-wallet',
    },
    capabilities: {
        mockWalletSeeding: true,
      personalWalletPid: true,
      personalWalletPoa: true,
      companyWalletEucc: true,
      reviewAssembly: true,
      vatIssuance: true,
      issuanceTracking: true,
    },
  },
  {
    id: 'igrant-sandbox',
    label: 'iGrant Sandbox Shape',
    description: 'Preview profile for a future adapter-backed vendor integration.',
    badge: 'Adapter-ready',
    walletInteraction: {
      personal: 'external-wallet-app',
      company: 'external-wallet-app',
    },
    capabilities: {
        mockWalletSeeding: true,
      personalWalletPid: true,
      personalWalletPoa: true,
      companyWalletEucc: true,
      reviewAssembly: true,
      vatIssuance: true,
      issuanceTracking: true,
    },
  },
];

export const workflowStepDefinitions: WorkflowStepDefinition[] = [
  {
    key: 'pid',
    title: 'PID identification',
    summary: 'Request a normalized PID record from the personal wallet.',
    walletRole: 'personal',
    dependsOn: [],
  },
  {
    key: 'poa',
    title: 'PoA collection',
    summary: 'Request normalized power-of-attorney evidence from the personal wallet.',
    walletRole: 'personal',
    dependsOn: ['pid'],
  },
  {
    key: 'eucc',
    title: 'EUCC collection',
    summary: 'Request normalized organization evidence from the company wallet.',
    walletRole: 'company',
    dependsOn: ['pid'],
  },
  {
    key: 'review',
    title: 'Review payload',
    summary: 'Assemble PID, company, PoA, and EUCC into one review object.',
    walletRole: 'operator',
    dependsOn: ['poa', 'eucc'],
  },
  {
    key: 'vatIssuance',
    title: 'VAT issuance',
    summary: 'Submit the request and track the normalized issuance result.',
    walletRole: 'company',
    dependsOn: ['review'],
  },
];

export const workflowStatusLabels: Record<WorkflowStepStatus, string> = {
  'not-started': 'Not started',
  ready: 'Ready',
  blocked: 'Blocked',
  pending: 'Pending',
  succeeded: 'Succeeded',
  failed: 'Failed',
};

export function createWorkflowStep<T>(
  key: WorkflowStepKey,
  walletRole: WalletRole,
  status: WorkflowStepStatus,
): WorkflowStep<T> {
  return {
    key,
    walletRole,
    status,
  };
}

export function createInitialSession(vendorId: VendorId, now = new Date().toISOString()): OrchestrationSession {
  return {
    sessionId: `session-${vendorId}`,
    vendorId,
    lifecycle: 'draft',
    createdAt: now,
    updatedAt: now,
    wallets: {
      personal: {
        walletRole: 'personal',
        loadedCredentials: [],
      },
      company: {
        walletRole: 'company',
        loadedCredentials: [],
      },
    },
    pid: createWorkflowStep<PidStepData>('pid', 'personal', 'ready'),
    poa: createWorkflowStep<PoaStepData>('poa', 'personal', 'blocked'),
    eucc: createWorkflowStep<EuccStepData>('eucc', 'company', 'blocked'),
    review: createWorkflowStep<ReviewPayload>('review', 'operator', 'blocked'),
    vatIssuance: createWorkflowStep<VatIssuanceResult>('vatIssuance', 'company', 'blocked'),
    eventLog: [
      {
        step: 'pid',
        status: 'ready',
        timestamp: now,
        message: 'Session created and ready for PID collection.',
      },
    ],
  };
}

export function isSeedableWalletRole(value: string): value is SeedableWalletRole {
  return value === 'personal' || value === 'company';
}

export function isWalletCredentialType(value: string): value is WalletCredentialType {
  return value === 'pid' || value === 'poa' || value === 'eucc' || value === 'vat';
}

function getWalletCredentialStep(credentialType: WalletCredentialType): WorkflowStepKey {
  if (credentialType === 'vat') {
    return 'vatIssuance';
  }

  return credentialType;
}

export function isAdapterSimulationMode(value: string): value is AdapterSimulationMode {
  return value === 'success' || value === 'failure' || value === 'pending';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function upsertWalletCredential(
  session: OrchestrationSession,
  walletRole: SeedableWalletRole,
  credential: WalletCredentialSummary,
): OrchestrationSession {
  const existingCredentials = session.wallets[walletRole].loadedCredentials.filter(
    (item) => item.credentialType !== credential.credentialType,
  );

  return {
    ...session,
    updatedAt: credential.seededAt,
    wallets: {
      ...session.wallets,
      [walletRole]: {
        ...session.wallets[walletRole],
        loadedCredentials: [...existingCredentials, credential],
      },
    },
    eventLog: [
      ...session.eventLog,
      {
        step: getWalletCredentialStep(credential.credentialType),
        status: 'ready',
        timestamp: credential.seededAt,
        message: `Seeded ${credential.label} into the ${walletRole} wallet.`,
      },
    ],
  };
}

export function isVendorId(value: string): value is VendorId {
  return vendorCatalog.some((vendor) => vendor.id === value);
}

export function isWorkflowStepKey(value: string): value is WorkflowStepKey {
  return workflowStepDefinitions.some((definition) => definition.key === value);
}

function areStepDependenciesSatisfied(session: OrchestrationSession, stepKey: WorkflowStepKey): boolean {
  const definition = workflowStepDefinitions.find((item) => item.key === stepKey);

  if (!definition) {
    return false;
  }

  return definition.dependsOn.every((dependencyKey) => session[dependencyKey].status === 'succeeded');
}

function reconcileDependentStatuses(session: OrchestrationSession): OrchestrationSession {
  const nextSession = {
    ...session,
  };

  for (const definition of workflowStepDefinitions) {
    const stepKey = definition.key;
    const currentStep = nextSession[stepKey];
    const hasLockedState = currentStep.status === 'blocked' || currentStep.status === 'ready' || currentStep.status === 'not-started';

    if (!hasLockedState) {
      continue;
    }

    const nextStatus = areStepDependenciesSatisfied(nextSession, stepKey) ? 'ready' : definition.dependsOn.length === 0 ? 'ready' : 'blocked';

    switch (stepKey) {
      case 'pid':
        nextSession.pid = {
          ...nextSession.pid,
          status: nextStatus,
        };
        break;
      case 'poa':
        nextSession.poa = {
          ...nextSession.poa,
          status: nextStatus,
        };
        break;
      case 'eucc':
        nextSession.eucc = {
          ...nextSession.eucc,
          status: nextStatus,
        };
        break;
      case 'review':
        nextSession.review = {
          ...nextSession.review,
          status: nextStatus,
        };
        break;
      case 'vatIssuance':
        nextSession.vatIssuance = {
          ...nextSession.vatIssuance,
          status: nextStatus,
        };
        break;
    }
  }

  return nextSession;
}

function createCompanyContextFromEucc(euccRecord: EuccRecord): CompanyContext {
  return {
    companyId: euccRecord.companyId,
    companyName: euccRecord.companyName,
    legalForm: euccRecord.legalForm,
    jurisdiction: euccRecord.registrationMemberState,
    registeredOffice: euccRecord.registeredAddress,
  };
}

export function updateSessionStep<K extends WorkflowStepKey>(
  session: OrchestrationSession,
  mutation: UpdateSessionStepRequest<K>,
  now = mutation.updatedAt ?? new Date().toISOString(),
): OrchestrationSession {
  const nextSession: OrchestrationSession = {
    ...session,
    updatedAt: now,
    [mutation.step]: {
      ...session[mutation.step],
      status: mutation.status,
      data: mutation.data,
      error: mutation.error,
      updatedAt: now,
    },
    lastError: mutation.error,
    eventLog: [
      ...session.eventLog,
      {
        step: mutation.step,
        status: mutation.status,
        timestamp: now,
        message: mutation.message ?? `Session step ${mutation.step} updated to ${mutation.status}.`,
      },
    ],
  };

    if (mutation.step === 'eucc') {
      const euccData = mutation.data as SessionStepDataMap['eucc'] | undefined;

      if (euccData?.record) {
        nextSession.companyContext = createCompanyContextFromEucc(euccData.record);
      }
  }

  const reconciledSession = reconcileDependentStatuses(nextSession);
  reconciledSession.lifecycle = deriveLifecycle(reconciledSession);

  return reconciledSession;
}

export function getWorkflowStepSnapshots(session: OrchestrationSession): WorkflowStepSnapshot[] {
  return workflowStepDefinitions.map((definition) => {
    const step = session[definition.key];

    return {
      ...definition,
      status: step.status,
      data: step.data,
      error: step.error,
      updatedAt: step.updatedAt,
    };
  });
}

export function deriveLifecycle(session: OrchestrationSession): SessionLifecycleStatus {
  if (session.vatIssuance.status === 'failed' || session.review.status === 'failed') {
    return 'failed';
  }

  if (session.vatIssuance.status === 'succeeded') {
    return 'completed';
  }

  if (session.vatIssuance.status === 'pending') {
    return 'submitting';
  }

  if (session.review.status === 'succeeded') {
    return 'ready-for-review';
  }

  if (
    session.pid.status === 'succeeded' ||
    session.poa.status === 'succeeded' ||
    session.eucc.status === 'succeeded'
  ) {
    return 'in-progress';
  }

  return 'draft';
}