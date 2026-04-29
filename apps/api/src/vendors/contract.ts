import type {
  AdapterSimulationMode,
  EuccStepData,
  EuccRecord,
  NormalizedError,
  OrchestrationSession,
  PidStepData,
  PidRecord,
  PoaStepData,
  PoaRecord,
  ReviewPayload,
  SeedableWalletRole,
  VatIssuanceResult,
  VendorDefinition,
  WalletCredentialSummary,
  WalletCredentialType,
} from '@we-build/domain';

export type AdapterOperationResult<T> = {
  status: 'succeeded' | 'pending' | 'failed';
  data?: T;
  error?: NormalizedError;
  message: string;
};

export type AdapterRequestOptions = {
  simulationMode?: AdapterSimulationMode;
};

export interface VendorAdapter {
  readonly definition: VendorDefinition;

  seedWalletCredential(
    session: OrchestrationSession,
    walletRole: SeedableWalletRole,
    credentialType: WalletCredentialType,
  ): Promise<AdapterOperationResult<WalletCredentialSummary>>;

  requestPid(session: OrchestrationSession, options?: AdapterRequestOptions): Promise<AdapterOperationResult<PidStepData>>;
  requestPoa(session: OrchestrationSession, options?: AdapterRequestOptions): Promise<AdapterOperationResult<PoaStepData>>;
  requestEucc(session: OrchestrationSession, options?: AdapterRequestOptions): Promise<AdapterOperationResult<EuccStepData>>;
  assembleReview(session: OrchestrationSession, options?: AdapterRequestOptions): Promise<AdapterOperationResult<ReviewPayload>>;
  submitVatIssuance(session: OrchestrationSession, options?: AdapterRequestOptions): Promise<AdapterOperationResult<VatIssuanceResult>>;
  readIssuanceStatus(session: OrchestrationSession, options?: AdapterRequestOptions): Promise<AdapterOperationResult<VatIssuanceResult>>;
}