export type VendorId = 'mock-local' | 'igrant-sandbox';
export type WalletRole = 'personal' | 'company' | 'operator';
export type SeedableWalletRole = 'personal' | 'company';
export type WalletCredentialType = 'pid' | 'poa' | 'eucc' | 'vat';
export type WorkflowStepKey = 'pid' | 'poa' | 'eucc' | 'review' | 'vatIssuance';
export type WorkflowStepStatus = 'not-started' | 'ready' | 'blocked' | 'pending' | 'succeeded' | 'failed';
export type SessionLifecycleStatus = 'draft' | 'in-progress' | 'ready-for-review' | 'submitting' | 'completed' | 'failed';
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
    data?: PidStepData | CompanyContext | PoaStepData | EuccStepData | ReviewPayload | VatIssuanceResult;
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
export declare const vendorCatalog: VendorDefinition[];
export declare const workflowStepDefinitions: WorkflowStepDefinition[];
export declare const workflowStatusLabels: Record<WorkflowStepStatus, string>;
export declare function createWorkflowStep<T>(key: WorkflowStepKey, walletRole: WalletRole, status: WorkflowStepStatus): WorkflowStep<T>;
export declare function createInitialSession(vendorId: VendorId, now?: string): OrchestrationSession;
export declare function isSeedableWalletRole(value: string): value is SeedableWalletRole;
export declare function isWalletCredentialType(value: string): value is WalletCredentialType;
export declare function isAdapterSimulationMode(value: string): value is AdapterSimulationMode;
export declare function upsertWalletCredential(session: OrchestrationSession, walletRole: SeedableWalletRole, credential: WalletCredentialSummary): OrchestrationSession;
export declare function isVendorId(value: string): value is VendorId;
export declare function isWorkflowStepKey(value: string): value is WorkflowStepKey;
export declare function updateSessionStep<K extends WorkflowStepKey>(session: OrchestrationSession, mutation: UpdateSessionStepRequest<K>, now?: string): OrchestrationSession;
export declare function getWorkflowStepSnapshots(session: OrchestrationSession): WorkflowStepSnapshot[];
export declare function deriveLifecycle(session: OrchestrationSession): SessionLifecycleStatus;
//# sourceMappingURL=index.d.ts.map