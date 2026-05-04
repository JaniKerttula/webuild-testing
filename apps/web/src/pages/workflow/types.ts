import type {
  AdapterSimulationMode,
  OrchestrationSession,
  SeedableWalletRole,
  SessionActionKey,
  WorkflowStepStatus,
  WorkflowStepKey,
  VendorDefinition,
  VendorId,
  WalletCredentialType,
} from '@we-build/domain';

export type HealthState = {
  status: 'loading' | 'ok' | 'error';
  detail: string;
};

export type SessionState = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  detail: string;
};

export type JourneyPageId = 'landing' | 'success' | WorkflowStepKey;

export type JourneyNavigationItem = {
  id: JourneyPageId;
  label: string;
  description: string;
  stepKey?: WorkflowStepKey;
  stepNumber?: number;
  disabled?: boolean;
};

export type WorkflowPageProps = {
  apiBaseUrl: string;
  vendorOptions: VendorDefinition[];
  selectedVendor: VendorId;
  selectedVendorOption?: VendorDefinition;
  session: OrchestrationSession | null;
  sessionState: SessionState;
  health: HealthState;
  onVendorChange: (vendorId: VendorId) => void;
  onStartNewSession: () => void;
  onTriggerAction: (actionKey: SessionActionKey, simulationMode?: AdapterSimulationMode) => void;
  onResetStep: (stepKey: WorkflowStepKey, status: WorkflowStepStatus, message: string) => void;
  onRestartStep: (stepKey: WorkflowStepKey) => void;
  onSeedWalletCredential: (walletRole: SeedableWalletRole, credentialType: WalletCredentialType) => void;
};