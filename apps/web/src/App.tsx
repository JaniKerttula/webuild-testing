import { useEffect, useRef, useState } from 'react';
import {
  isWorkflowStepKey,
  workflowStepDefinitions,
  type AdapterSimulationMode,
  type OrchestrationSession,
  type SeedableWalletRole,
  type SessionActionKey,
  type VendorId,
  type VendorDefinition,
  type WalletCredentialType,
  type WorkflowStepKey,
  type WorkflowStepStatus,
} from '@we-build/domain';

import { AppShell } from './components/AppShell.js';
import { I18nProvider, formatTranslation, getInitialLocale, getTranslations, localeStorageKey, type AppLocale } from './i18n.js';
import { LandingPage } from './pages/LandingPage.js';
import { SuccessPage } from './pages/SuccessPage.js';
import { WorkflowStepPage } from './pages/WorkflowStepPage.js';
import { getActionLabels } from './workflowUi.js';
import type { HealthState, JourneyNavigationItem, JourneyPageId, SessionState } from './pages/workflow/types.js';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

type PollableStepKey = 'pid' | 'poa' | 'eucc' | 'vatIssuance';

const pollableStepKeys: PollableStepKey[] = ['pid', 'poa', 'eucc', 'vatIssuance'];

function isPollableStepKey(stepKey: WorkflowStepKey | SessionActionKey): stepKey is PollableStepKey {
  return stepKey === 'pid' || stepKey === 'poa' || stepKey === 'eucc' || stepKey === 'vatIssuance';
}

function hasPendingRemoteHistory(session: OrchestrationSession, stepKey: PollableStepKey): boolean {
  if (stepKey === 'vatIssuance') {
    return session.vatIssuance.status === 'pending' && Boolean(session.vatIssuance.data?.exchangeId);
  }

  return session[stepKey].status === 'pending' && Boolean(session[stepKey].data?.request?.exchangeId);
}

function getPendingRemoteHistorySteps(session: OrchestrationSession | null): PollableStepKey[] {
  if (!session) {
    return [];
  }

  return pollableStepKeys.filter((stepKey) => hasPendingRemoteHistory(session, stepKey));
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function getSessionStorageKey(vendorId: VendorId): string {
  return `we-build-testing:session:${vendorId}`;
}

function isJourneyPageEnabled(session: OrchestrationSession | null, pageId: JourneyPageId): boolean {
  if (pageId === 'landing') {
    return true;
  }

  if (pageId === 'success') {
    return session?.vatIssuance.status === 'succeeded';
  }

  if (!session) {
    return false;
  }

  const step = session[pageId];
  return step.status !== 'blocked' && step.status !== 'not-started';
}

export default function App() {
  const [locale, setLocale] = useState<AppLocale>(() => getInitialLocale());
  const t = getTranslations(locale);
  const actionLabels = getActionLabels(locale);
  const workflowStatusLabels = t.statuses.workflow;
  const runtime = t.runtime;
  const [vendorOptions, setVendorOptions] = useState<VendorDefinition[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<VendorId>('igrant-sandbox');
  const [currentPageId, setCurrentPageId] = useState<JourneyPageId>('landing');
  const [session, setSession] = useState<OrchestrationSession | null>(null);
  const [sessionState, setSessionState] = useState<SessionState>({
    status: 'idle',
    detail: runtime.sessionNotLoaded,
  });
  const [health, setHealth] = useState<HealthState>({
    status: 'loading',
    detail: runtime.checkingApiHealth,
  });
  const pollingGenerationRef = useRef(0);
  const previousVatIssuanceStatusRef = useRef<WorkflowStepStatus | null>(null);
  const pollControllerRef = useRef<Record<PollableStepKey, AbortController | null>>({
    pid: null,
    poa: null,
    eucc: null,
    vatIssuance: null,
  });

  useEffect(() => {
    window.localStorage.setItem(localeStorageKey, locale);
  }, [locale]);

  function invalidatePolling(stepKeys: PollableStepKey[] = pollableStepKeys): number {
    stepKeys.forEach((stepKey) => {
      pollControllerRef.current[stepKey]?.abort();
      pollControllerRef.current[stepKey] = null;
    });

    pollingGenerationRef.current += 1;
    return pollingGenerationRef.current;
  }

  function beginPollingRequest(stepKey: PollableStepKey): AbortController {
    pollControllerRef.current[stepKey]?.abort();
    const controller = new AbortController();
    pollControllerRef.current[stepKey] = controller;
    return controller;
  }

  function clearPollingRequest(stepKey: PollableStepKey, controller: AbortController): void {
    if (pollControllerRef.current[stepKey] === controller) {
      pollControllerRef.current[stepKey] = null;
    }
  }

  async function deleteStepHistory(sessionId: string, stepKey: PollableStepKey): Promise<void> {
    const response = await fetch(`${apiBaseUrl}/api/sessions/${sessionId}/steps/${stepKey}/history`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      throw new Error(payload?.error ?? `Step history cleanup failed with ${response.status}`);
    }
  }

  async function cleanupPendingRemoteHistory(sessionSnapshot: OrchestrationSession, stepKeys: PollableStepKey[]): Promise<void> {
    for (const stepKey of stepKeys) {
      if (!hasPendingRemoteHistory(sessionSnapshot, stepKey)) {
        continue;
      }

      await deleteStepHistory(sessionSnapshot.sessionId, stepKey);
    }
  }

  async function loadVendors(): Promise<void> {
    const response = await fetch(`${apiBaseUrl}/api/vendors`);

    if (!response.ok) {
      throw new Error(`Vendor fetch failed with ${response.status}`);
    }

    const payload = (await response.json()) as VendorDefinition[];
    setVendorOptions(payload);

    const preferredVendor = payload.find((vendor) => vendor.id === 'igrant-sandbox') ?? payload[0];

    if (!payload.some((vendor) => vendor.id === selectedVendor) && preferredVendor) {
      setSelectedVendor(preferredVendor.id);
    }
  }

  async function createSession(vendorId: VendorId): Promise<OrchestrationSession> {
    const response = await fetch(`${apiBaseUrl}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ vendorId }),
    });

    if (!response.ok) {
      throw new Error(`Session creation failed with ${response.status}`);
    }

    const payload = (await response.json()) as OrchestrationSession;
    localStorage.setItem(getSessionStorageKey(vendorId), payload.sessionId);
    return payload;
  }

  async function loadSession(vendorId: VendorId): Promise<OrchestrationSession> {
    const storedSessionId = localStorage.getItem(getSessionStorageKey(vendorId));

    if (!storedSessionId) {
      return createSession(vendorId);
    }

    const response = await fetch(`${apiBaseUrl}/api/sessions/${storedSessionId}`);

    if (response.status === 404) {
      localStorage.removeItem(getSessionStorageKey(vendorId));
      return createSession(vendorId);
    }

    if (!response.ok) {
      throw new Error(`Session fetch failed with ${response.status}`);
    }

    return (await response.json()) as OrchestrationSession;
  }

  async function refreshSession(vendorId: VendorId): Promise<void> {
    setSessionState({
      status: 'loading',
      detail: runtime.loadingSession,
    });

    try {
      const nextSession = await loadSession(vendorId);
      setSession(nextSession);
      setSessionState({
        status: 'ready',
        detail: formatTranslation(runtime.loadedSession, { sessionId: nextSession.sessionId }),
      });
    } catch (error) {
      setSession(null);
      setSessionState({
        status: 'error',
        detail: error instanceof Error ? error.message : runtime.unknownSessionLoadingError,
      });
    }
  }

  async function startNewSession(): Promise<void> {
    const sessionSnapshot = session;
    const pendingHistorySteps = getPendingRemoteHistorySteps(sessionSnapshot);

    invalidatePolling();
    setSessionState({
      status: 'loading',
      detail: runtime.creatingSession,
    });

    try {
      if (sessionSnapshot) {
        await cleanupPendingRemoteHistory(sessionSnapshot, pendingHistorySteps);
      }

      setSession(null);
      const nextSession = await createSession(selectedVendor);
      setSession(nextSession);
      setSessionState({
        status: 'ready',
        detail: formatTranslation(runtime.createdSession, { sessionId: nextSession.sessionId }),
      });
    } catch (error) {
      setSessionState({
        status: 'error',
        detail: error instanceof Error ? error.message : runtime.unknownSessionCreationError,
      });
    }
  }

  async function triggerAction(actionKey: SessionActionKey, simulationMode: AdapterSimulationMode = 'success'): Promise<void> {
    if (!session) {
      return;
    }

    const isRetryingEvidenceRequest = isPollableStepKey(actionKey) && hasPendingRemoteHistory(session, actionKey);

    if (isRetryingEvidenceRequest) {
      invalidatePolling([actionKey]);
    }

    setSessionState({
      status: 'loading',
      detail: formatTranslation(
        isRetryingEvidenceRequest ? runtime.retryingAction : runtime.runningAction,
        {
          action: actionLabels[actionKey],
          mode: runtime.simulationModes[simulationMode],
        },
      ),
    });

    try {
      if (isRetryingEvidenceRequest && isPollableStepKey(actionKey)) {
        await cleanupPendingRemoteHistory(session, [actionKey]);
      }

      const response = await fetch(`${apiBaseUrl}/api/sessions/${session.sessionId}/actions/${actionKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ simulationMode }),
      });

      if (!response.ok) {
        throw new Error(`Action execution failed with ${response.status}`);
      }

      const nextSession = (await response.json()) as OrchestrationSession;
      const updatedStep = actionKey === 'issuanceStatus' ? nextSession.vatIssuance : nextSession[actionKey];
      setSession(nextSession);
      setSessionState({
        status: 'ready',
        detail: formatTranslation(runtime.actionCompleted, {
          action: actionLabels[actionKey],
          status: workflowStatusLabels[updatedStep.status],
        }),
      });
    } catch (error) {
      setSessionState({
        status: 'error',
        detail: error instanceof Error ? error.message : runtime.unknownActionExecutionError,
      });
    }
  }

  async function resetStep(stepKey: WorkflowStepKey, status: WorkflowStepStatus, message: string): Promise<void> {
    if (!session) {
      return;
    }

    const shouldCleanupRemoteHistory = isPollableStepKey(stepKey) && hasPendingRemoteHistory(session, stepKey);

    if (shouldCleanupRemoteHistory && isPollableStepKey(stepKey)) {
      invalidatePolling([stepKey]);
    }

    setSessionState({
      status: 'loading',
      detail: message,
    });

    try {
      if (shouldCleanupRemoteHistory && isPollableStepKey(stepKey)) {
        await cleanupPendingRemoteHistory(session, [stepKey]);
      }

      const response = await fetch(`${apiBaseUrl}/api/sessions/${session.sessionId}/steps/${stepKey}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status,
          message,
        }),
      });

      if (!response.ok) {
        throw new Error(`Step reset failed with ${response.status}`);
      }

      const nextSession = (await response.json()) as OrchestrationSession;
      setSession(nextSession);
      setSessionState({
        status: 'ready',
        detail: message,
      });
    } catch (error) {
      setSessionState({
        status: 'error',
        detail: error instanceof Error ? error.message : runtime.unknownStepResetError,
      });
    }
  }

  async function restartWorkflowStep(stepKey: WorkflowStepKey): Promise<void> {
    if (!session || (stepKey !== 'pid' && stepKey !== 'poa' && stepKey !== 'eucc' && stepKey !== 'vatIssuance')) {
      return;
    }

    const shouldCleanupRemoteHistory = isPollableStepKey(stepKey) && hasPendingRemoteHistory(session, stepKey);

    if (shouldCleanupRemoteHistory && isPollableStepKey(stepKey)) {
      invalidatePolling([stepKey]);
    }

    setSessionState({
      status: 'loading',
      detail: formatTranslation(runtime.restartingAction, { action: actionLabels[stepKey] }),
    });

    try {
      if (shouldCleanupRemoteHistory && isPollableStepKey(stepKey)) {
        await cleanupPendingRemoteHistory(session, [stepKey]);
      }

      const resetResponse = await fetch(`${apiBaseUrl}/api/sessions/${session.sessionId}/steps/${stepKey}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'ready',
          message: formatTranslation(runtime.resetBeforeRestart, { action: actionLabels[stepKey] }),
        }),
      });

      if (!resetResponse.ok) {
        throw new Error(`Step reset failed with ${resetResponse.status}`);
      }

      const resetSession = (await resetResponse.json()) as OrchestrationSession;
      setSession(resetSession);

      const actionResponse = await fetch(`${apiBaseUrl}/api/sessions/${session.sessionId}/actions/${stepKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ simulationMode: 'success' }),
      });

      if (!actionResponse.ok) {
        throw new Error(`Action execution failed with ${actionResponse.status}`);
      }

      const nextSession = (await actionResponse.json()) as OrchestrationSession;
      setSession(nextSession);
      setSessionState({
        status: 'ready',
        detail: formatTranslation(runtime.actionCompleted, {
          action: actionLabels[stepKey],
          status: workflowStatusLabels[nextSession[stepKey].status],
        }),
      });
    } catch (error) {
      setSessionState({
        status: 'error',
        detail: error instanceof Error ? error.message : runtime.unknownStepRestartError,
      });
    }
  }

  async function pollPendingPid(sessionId: string, pollingGeneration: number): Promise<void> {
    const controller = beginPollingRequest('pid');

    try {
      const response = await fetch(`${apiBaseUrl}/api/sessions/${sessionId}/actions/pid`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`PID polling failed with ${response.status}`);
      }

      const nextSession = (await response.json()) as OrchestrationSession;

      if (pollingGeneration !== pollingGenerationRef.current) {
        return;
      }

      setSession(nextSession);

      if (nextSession.pid.status === 'succeeded') {
        setSessionState({
          status: 'ready',
          detail: runtime.credentialReceived.pid,
        });
        return;
      }

      if (nextSession.pid.status === 'failed') {
        setSessionState({
          status: 'error',
          detail: nextSession.pid.error?.message ?? runtime.credentialVerificationFailed.pid,
        });
      }
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }

      if (pollingGeneration !== pollingGenerationRef.current) {
        return;
      }

      setSessionState({
        status: 'error',
        detail: error instanceof Error ? error.message : runtime.unknownPollingError.pid,
      });
    } finally {
      clearPollingRequest('pid', controller);
    }
  }

  async function pollPendingPoa(sessionId: string, pollingGeneration: number): Promise<void> {
    const controller = beginPollingRequest('poa');

    try {
      const response = await fetch(`${apiBaseUrl}/api/sessions/${sessionId}/actions/poa`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`PoA polling failed with ${response.status}`);
      }

      const nextSession = (await response.json()) as OrchestrationSession;

      if (pollingGeneration !== pollingGenerationRef.current) {
        return;
      }

      setSession(nextSession);

      if (nextSession.poa.status === 'succeeded') {
        setSessionState({
          status: 'ready',
          detail: runtime.credentialReceived.poa,
        });
        return;
      }

      if (nextSession.poa.status === 'failed') {
        setSessionState({
          status: 'error',
          detail: nextSession.poa.error?.message ?? runtime.credentialVerificationFailed.poa,
        });
      }
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }

      if (pollingGeneration !== pollingGenerationRef.current) {
        return;
      }

      setSessionState({
        status: 'error',
        detail: error instanceof Error ? error.message : runtime.unknownPollingError.poa,
      });
    } finally {
      clearPollingRequest('poa', controller);
    }
  }

  async function pollPendingEucc(sessionId: string, pollingGeneration: number): Promise<void> {
    const controller = beginPollingRequest('eucc');

    try {
      const response = await fetch(`${apiBaseUrl}/api/sessions/${sessionId}/actions/eucc`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`EUCC polling failed with ${response.status}`);
      }

      const nextSession = (await response.json()) as OrchestrationSession;

      if (pollingGeneration !== pollingGenerationRef.current) {
        return;
      }

      setSession(nextSession);

      if (nextSession.eucc.status === 'succeeded') {
        setSessionState({
          status: 'ready',
          detail: runtime.credentialReceived.eucc,
        });
        return;
      }

      if (nextSession.eucc.status === 'failed') {
        setSessionState({
          status: 'error',
          detail: nextSession.eucc.error?.message ?? runtime.credentialVerificationFailed.eucc,
        });
      }
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }

      if (pollingGeneration !== pollingGenerationRef.current) {
        return;
      }

      setSessionState({
        status: 'error',
        detail: error instanceof Error ? error.message : runtime.unknownPollingError.eucc,
      });
    } finally {
      clearPollingRequest('eucc', controller);
    }
  }

  async function pollPendingVatIssuance(sessionId: string, pollingGeneration: number): Promise<void> {
    const controller = beginPollingRequest('vatIssuance');

    try {
      const response = await fetch(`${apiBaseUrl}/api/sessions/${sessionId}/actions/issuanceStatus`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`VAT issuance polling failed with ${response.status}`);
      }

      const nextSession = (await response.json()) as OrchestrationSession;

      if (pollingGeneration !== pollingGenerationRef.current) {
        return;
      }

      setSession(nextSession);

      if (nextSession.vatIssuance.status === 'succeeded') {
        setSessionState({
          status: 'ready',
          detail: runtime.vatIssued,
        });
        return;
      }

      if (nextSession.vatIssuance.status === 'failed') {
        setSessionState({
          status: 'error',
          detail: nextSession.vatIssuance.error?.message ?? runtime.vatIssuanceFailed,
        });
      }
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }

      if (pollingGeneration !== pollingGenerationRef.current) {
        return;
      }

      setSessionState({
        status: 'error',
        detail: error instanceof Error ? error.message : runtime.unknownPollingError.vatIssuance,
      });
    } finally {
      clearPollingRequest('vatIssuance', controller);
    }
  }

  async function seedWalletCredential(walletRole: SeedableWalletRole, credentialType: WalletCredentialType): Promise<void> {
    if (!session) {
      return;
    }

    setSessionState({
      status: 'loading',
      detail: formatTranslation(runtime.seedingWallet, {
        credentialType: t.wallets.credentialTypeLabels[credentialType],
        walletRole: t.wallets.walletRoleLabels[walletRole],
      }),
    });

    try {
      const response = await fetch(`${apiBaseUrl}/api/sessions/${session.sessionId}/wallets/${walletRole}/credentials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ credentialType }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(payload?.error ?? `Wallet seeding failed with ${response.status}`);
      }

      const nextSession = (await response.json()) as OrchestrationSession;
      setSession(nextSession);
      setSessionState({
        status: 'ready',
        detail: selectedVendorOption?.walletInteraction[walletRole] === 'external-wallet-app'
          ? formatTranslation(runtime.walletOfferCreated, {
              credentialType: t.wallets.credentialTypeLabels[credentialType],
              walletRole: t.wallets.walletRoleLabels[walletRole],
            })
          : formatTranslation(runtime.walletSeeded, {
              credentialType: t.wallets.credentialTypeLabels[credentialType],
              walletRole: t.wallets.walletRoleLabels[walletRole],
            }),
      });
    } catch (error) {
      setSessionState({
        status: 'error',
        detail: error instanceof Error ? error.message : runtime.unknownWalletSeedingError,
      });
    }
  }

  useEffect(() => {
    const controller = new AbortController();

    void fetch(`${apiBaseUrl}/health`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Health check failed with ${response.status}`);
        }

        const payload = (await response.json()) as { status: string; service: string };
        setHealth({
          status: 'ok',
          detail: formatTranslation(runtime.healthResponding, {
            service: payload.service,
            status: payload.status,
          }),
        });
      })
      .catch((error: unknown) => {
        if ((error as Error).name === 'AbortError') {
          return;
        }

        setHealth({
          status: 'error',
          detail: error instanceof Error ? error.message : runtime.unknownHealthCheckError,
        });
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    void loadVendors().catch((error) => {
      setSessionState({
        status: 'error',
        detail: error instanceof Error ? error.message : runtime.unknownVendorLoadingError,
      });
    });
  }, []);

  useEffect(() => {
    if (!vendorOptions.length) {
      return;
    }

    void refreshSession(selectedVendor);
  }, [selectedVendor, vendorOptions.length]);

  useEffect(() => {
    if (selectedVendor !== 'igrant-sandbox' || !session?.sessionId) {
      return;
    }

    const exchangeId = session.pid.data?.request?.exchangeId;
    const pidUpdatedAt = session.pid.updatedAt;

    if (session.pid.status !== 'pending' || !exchangeId) {
      return;
    }

    const pollingGeneration = pollingGenerationRef.current;

    const intervalId = window.setInterval(() => {
      void pollPendingPid(session.sessionId, pollingGeneration);
    }, 10000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [selectedVendor, session?.sessionId, session?.pid.status, session?.pid.data?.request?.exchangeId, session?.pid.updatedAt]);

  useEffect(() => {
    if (selectedVendor !== 'igrant-sandbox' || !session?.sessionId) {
      return;
    }

    const exchangeId = session.poa.data?.request?.exchangeId;
    const poaUpdatedAt = session.poa.updatedAt;

    if (session.poa.status !== 'pending' || !exchangeId) {
      return;
    }

    const pollingGeneration = pollingGenerationRef.current;

    const intervalId = window.setInterval(() => {
      void pollPendingPoa(session.sessionId, pollingGeneration);
    }, 10000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [selectedVendor, session?.sessionId, session?.poa.status, session?.poa.data?.request?.exchangeId, session?.poa.updatedAt]);

  useEffect(() => {
    if (selectedVendor !== 'igrant-sandbox' || !session?.sessionId) {
      return;
    }

    const exchangeId = session.eucc.data?.request?.exchangeId;
    const euccUpdatedAt = session.eucc.updatedAt;

    if (session.eucc.status !== 'pending' || !exchangeId) {
      return;
    }

    const pollingGeneration = pollingGenerationRef.current;

    const intervalId = window.setInterval(() => {
      void pollPendingEucc(session.sessionId, pollingGeneration);
    }, 10000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [selectedVendor, session?.sessionId, session?.eucc.status, session?.eucc.data?.request?.exchangeId, session?.eucc.updatedAt]);

  useEffect(() => {
    if (selectedVendor !== 'igrant-sandbox' || !session?.sessionId) {
      return;
    }

    const exchangeId = session.vatIssuance.data?.exchangeId;

    if (session.vatIssuance.status !== 'pending' || !exchangeId) {
      return;
    }

    const pollingGeneration = pollingGenerationRef.current;

    const intervalId = window.setInterval(() => {
      void pollPendingVatIssuance(session.sessionId, pollingGeneration);
    }, 10000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [selectedVendor, session?.sessionId, session?.vatIssuance.status, session?.vatIssuance.data?.exchangeId]);

  useEffect(() => {
    const currentStatus = session?.vatIssuance.status ?? null;
    const previousStatus = previousVatIssuanceStatusRef.current;

    previousVatIssuanceStatusRef.current = currentStatus;

    if (currentStatus === 'succeeded' && previousStatus !== null && previousStatus !== 'succeeded') {
      setCurrentPageId('success');
    }
  }, [session?.vatIssuance.status]);

  useEffect(() => {
    if (currentPageId === 'landing' || isJourneyPageEnabled(session, currentPageId)) {
      return;
    }

    setCurrentPageId('landing');
  }, [
    currentPageId,
    session,
  ]);

  const selectedVendorOption = vendorOptions.find((vendor) => vendor.id === selectedVendor) ?? vendorOptions[0];
  const journeyNavigationItems: JourneyNavigationItem[] = [
    {
      id: 'landing',
      label: t.navigation.landing,
      description: t.landing.stepDescription,
    },
    ...workflowStepDefinitions.map((step, index) => ({
      id: step.key,
      label: t.navigation.stepLabels[step.key],
      description: t.navigation.stepDescriptions[step.key],
      stepKey: step.key,
      stepNumber: index + 1,
    })),
  ];
  const stepPages = journeyNavigationItems
    .filter((item) => item.id !== 'landing')
    .map((item) => ({
      ...item,
      disabled: isJourneyPageEnabled(session, item.id) === false,
    }));
  const firstEnabledStepPage = stepPages.find((page) => !page.disabled)?.id ?? 'landing';
  const workflowPageProps = {
    apiBaseUrl,
    vendorOptions,
    selectedVendor,
    selectedVendorOption,
    session,
    sessionState,
    health,
    onVendorChange: setSelectedVendor,
    onStartNewSession: () => void startNewSession(),
    onTriggerAction: (actionKey: SessionActionKey, simulationMode?: AdapterSimulationMode) => void triggerAction(actionKey, simulationMode),
    onResetStep: (stepKey: WorkflowStepKey, status: WorkflowStepStatus, message: string) => void resetStep(stepKey, status, message),
    onRestartStep: (stepKey: WorkflowStepKey) => void restartWorkflowStep(stepKey),
    onSeedWalletCredential: (walletRole: SeedableWalletRole, credentialType: WalletCredentialType) => void seedWalletCredential(walletRole, credentialType),
  };
  const pages = [
    {
      id: 'landing' as const,
      render: () => (
        <LandingPage
          {...workflowPageProps}
          stepPages={stepPages}
          onNavigate={setCurrentPageId}
          onStartWorkflow={() => setCurrentPageId(firstEnabledStepPage)}
        />
      ),
    },
    {
      id: 'success' as const,
      render: () => (
        <SuccessPage
          onReturnToStart={() => {
            setCurrentPageId('landing');
            void startNewSession();
          }}
        />
      ),
    },
    ...stepPages.map((page, index) => ({
      id: page.id,
      render: () => (
        <WorkflowStepPage
          {...workflowPageProps}
          stepKey={page.stepKey!}
          stepLabel={locale === 'fi' ? t.navigation.stepLabels[page.stepKey!] : workflowStepDefinitions[index].title}
          stepDescription={t.navigation.stepDescriptions[page.stepKey!]}
          stepPages={stepPages}
          openedPageIds={stepPages.filter((item) => !item.disabled).map((item) => item.id)}
          onNavigate={setCurrentPageId}
          nextPageId={stepPages.slice(index + 1).find((item) => !item.disabled)?.id}
        />
      ),
    })),
  ];
  const currentPage = pages.find((page) => page.id === currentPageId) ?? pages[0];

  return (
    <I18nProvider locale={locale} setLocale={setLocale}>
      <AppShell
        brandTitle={t.shell.brandTitle}
        onBrandClick={() => setCurrentPageId('landing')}
        languageSwitcherLabel={t.shell.languageSwitcherLabel}
        languageLinks={[
          { id: 'fi', label: 'FI', isCurrent: locale === 'fi', onSelect: () => setLocale('fi') },
          { id: 'en', label: 'EN', isCurrent: locale === 'en', onSelect: () => setLocale('en') },
        ]}
        footerLinks={[
          { href: '#session-overview', label: t.shell.footerLinks.dataProtection },
          { href: '#journey-overview', label: t.shell.footerLinks.accessibility },
          { href: '#status', label: t.shell.footerLinks.contactInformation },
        ]}
      >
        {currentPage.render()}
      </AppShell>
    </I18nProvider>
  );
}