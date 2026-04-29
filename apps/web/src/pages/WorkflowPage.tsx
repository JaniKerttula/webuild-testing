import {
  getWorkflowStepSnapshots,
} from '@we-build/domain';

import { PageHero } from '../components/PageLayout.js';
import { WorkflowEvidenceSection } from './workflow/WorkflowEvidenceSection.js';
import { WorkflowHistorySection } from './workflow/WorkflowHistorySection.js';
import { WorkflowSessionSection } from './workflow/WorkflowSessionSection.js';
import { WorkflowStepsSection } from './workflow/WorkflowStepsSection.js';
import { WorkflowWalletSetupSection } from './workflow/WorkflowWalletSetupSection.js';
import type { WorkflowPageProps } from './workflow/types.js';

export function WorkflowPage({
  apiBaseUrl,
  vendorOptions,
  selectedVendor,
  selectedVendorOption,
  session,
  sessionState,
  health,
  onVendorChange,
  onStartNewSession,
  onTriggerAction,
  onSeedWalletCredential,
}: WorkflowPageProps) {
  const isMockLocalVendor = selectedVendorOption?.id === 'mock-local';
  const allowsExternalActions = selectedVendorOption?.walletInteraction.personal === 'external-wallet-app'
    || selectedVendorOption?.walletInteraction.company === 'external-wallet-app';
  const canTriggerVendorActions = Boolean(session) && (isMockLocalVendor || allowsExternalActions);
  const stepCards = session ? getWorkflowStepSnapshots(session) : [];

  return (
    <>
      <PageHero
        eyebrow="Workflow"
        title="Mock VAT attestation workflow"
        intro="This demo site is for local development of the PID, PoA, EUCC, review, and VAT issuance journey."
        secondaryIntro="The workflow page now sits on generic page-building components so additional screens can reuse the same shell and section model."
      />

      <WorkflowSessionSection
        apiBaseUrl={apiBaseUrl}
        vendorOptions={vendorOptions}
        selectedVendor={selectedVendor}
        selectedVendorOption={selectedVendorOption}
        session={session}
        sessionState={sessionState}
        health={health}
        stepCount={stepCards.length}
        onVendorChange={onVendorChange}
        onStartNewSession={onStartNewSession}
        canTriggerVendorActions={canTriggerVendorActions}
        onTriggerAction={onTriggerAction}
      />

      <WorkflowWalletSetupSection
        session={session}
        selectedVendorOption={selectedVendorOption}
        onSeedWalletCredential={onSeedWalletCredential}
      />

      <WorkflowEvidenceSection session={session} isMockLocalVendor={isMockLocalVendor} focusStep="pid" />

      <WorkflowEvidenceSection session={session} isMockLocalVendor={isMockLocalVendor} focusStep="poa" />

      <WorkflowEvidenceSection session={session} isMockLocalVendor={isMockLocalVendor} focusStep="eucc" />

      <WorkflowStepsSection
        session={session}
        canTriggerVendorActions={canTriggerVendorActions}
        isMockLocalVendor={isMockLocalVendor}
        onTriggerAction={onTriggerAction}
      />

      <WorkflowHistorySection session={session} />
    </>
  );
}