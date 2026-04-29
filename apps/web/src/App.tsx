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

import { AppShell, type NavigationItem } from './components/AppShell.js';
import { I18nProvider, getInitialLocale, getTranslations, localeStorageKey, type AppLocale } from './i18n.js';
import { LandingPage } from './pages/LandingPage.js';
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
  const [vendorOptions, setVendorOptions] = useState<VendorDefinition[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<VendorId>('igrant-sandbox');
  const [currentPageId, setCurrentPageId] = useState<JourneyPageId>('landing');
  const [session, setSession] = useState<OrchestrationSession | null>(null);
  const [sessionState, setSessionState] = useState<SessionState>({
    status: 'idle',
    detail: locale === 'fi' ? 'Istuntoa ei ole vielä ladattu.' : 'No session loaded yet.',
  });
  const [health, setHealth] = useState<HealthState>({
    status: 'loading',
    detail: locale === 'fi' ? 'Tarkistetaan paikallisen API:n tila.' : 'Checking local API health.',
  });
  const pollingGenerationRef = useRef(0);
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
      detail: locale === 'fi' ? 'Ladataan istunto paikallisesta API:sta.' : 'Loading session from the local API.',
    });

    try {
      const nextSession = await loadSession(vendorId);
      setSession(nextSession);
      setSessionState({
        status: 'ready',
        detail: locale === 'fi'
          ? `Istunto ${nextSession.sessionId} ladattu.`
          : `Loaded session ${nextSession.sessionId}.`,
      });
    } catch (error) {
      setSession(null);
      setSessionState({
        status: 'error',
        detail: error instanceof Error ? error.message : locale === 'fi' ? 'Tuntematon virhe istunnon latauksessa.' : 'Unknown session loading error.',
      });
    }
  }

  async function startNewSession(): Promise<void> {
    const sessionSnapshot = session;
    const pendingHistorySteps = getPendingRemoteHistorySteps(sessionSnapshot);

    invalidatePolling();
    setSessionState({
      status: 'loading',
      detail: locale === 'fi' ? 'Luodaan uusi istunto paikalliseen API:in.' : 'Creating a new session in the local API.',
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
        detail: locale === 'fi' ? `Istunto ${nextSession.sessionId} luotu.` : `Created session ${nextSession.sessionId}.`,
      });
    } catch (error) {
      setSessionState({
        status: 'error',
        detail: error instanceof Error ? error.message : locale === 'fi' ? 'Tuntematon virhe istunnon luonnissa.' : 'Unknown session creation error.',
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
      detail: `${isRetryingEvidenceRequest ? `Retrying ${actionLabels[actionKey]}` : `Running ${actionLabels[actionKey]}`} in ${simulationMode} mode.`,
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
        detail: `${actionLabels[actionKey]} completed with ${updatedStep.status} state.`,
      });
    } catch (error) {
      setSessionState({
        status: 'error',
        detail: error instanceof Error ? error.message : locale === 'fi' ? 'Tuntematon virhe toiminnon suorituksessa.' : 'Unknown action execution error.',
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
        detail: error instanceof Error ? error.message : locale === 'fi' ? 'Tuntematon virhe vaiheen nollauksessa.' : 'Unknown step reset error.',
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
      detail: `Restarting ${actionLabels[stepKey]}.`,
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
          message: `${actionLabels[stepKey]} reset before restart.`,
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
        detail: `${actionLabels[stepKey]} completed with ${nextSession[stepKey].status} state.`,
      });
    } catch (error) {
      setSessionState({
        status: 'error',
        detail: error instanceof Error ? error.message : locale === 'fi' ? 'Tuntematon virhe vaiheen uudelleenkäynnistyksessä.' : 'Unknown step restart error.',
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
          detail: locale === 'fi' ? 'PID-tunnistetiedot vastaanotettu lompakosta.' : 'PID credential data received from the wallet.',
        });
        return;
      }

      if (nextSession.pid.status === 'failed') {
        setSessionState({
          status: 'error',
          detail: nextSession.pid.error?.message ?? (locale === 'fi'
            ? 'PID-tunnistetietojen varmennus epäonnistui lompakkokeruun aikana.'
            : 'PID credential verification failed during wallet collection.'),
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
        detail: error instanceof Error ? error.message : locale === 'fi' ? 'Tuntematon PID-kyselyvirhe.' : 'Unknown PID polling error.',
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
          detail: locale === 'fi' ? 'PoA-tunnistetiedot vastaanotettu lompakosta.' : 'PoA credential data received from the wallet.',
        });
        return;
      }

      if (nextSession.poa.status === 'failed') {
        setSessionState({
          status: 'error',
          detail: nextSession.poa.error?.message ?? (locale === 'fi'
            ? 'PoA-tunnistetietojen varmennus epäonnistui lompakkokeruun aikana.'
            : 'PoA credential verification failed during wallet collection.'),
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
        detail: error instanceof Error ? error.message : locale === 'fi' ? 'Tuntematon PoA-kyselyvirhe.' : 'Unknown PoA polling error.',
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
          detail: 'EUCC credential data received from the wallet.',
        });
        return;
      }

      if (nextSession.eucc.status === 'failed') {
        setSessionState({
          status: 'error',
          detail: nextSession.eucc.error?.message ?? 'EUCC credential verification failed during wallet collection.',
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
        detail: error instanceof Error ? error.message : 'Unknown EUCC polling error.',
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
          detail: 'VAT attestation issued to the company wallet.',
        });
        return;
      }

      if (nextSession.vatIssuance.status === 'failed') {
        setSessionState({
          status: 'error',
          detail: nextSession.vatIssuance.error?.message ?? 'VAT attestation issuance failed during wallet pickup.',
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
        detail: error instanceof Error ? error.message : 'Unknown VAT issuance polling error.',
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
      detail: `Seeding ${credentialType} into the ${walletRole} wallet.`,
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
          ? `${credentialType.toUpperCase()} OID4VCI offer created for the ${walletRole} wallet.`
          : `${credentialType.toUpperCase()} seeded into the ${walletRole} wallet.`,
      });
    } catch (error) {
      setSessionState({
        status: 'error',
        detail: error instanceof Error ? error.message : 'Unknown wallet seeding error.',
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
          detail: `${payload.service} is responding with status ${payload.status}.`,
        });
      })
      .catch((error: unknown) => {
        if ((error as Error).name === 'AbortError') {
          return;
        }

        setHealth({
          status: 'error',
          detail: error instanceof Error ? error.message : 'Unknown health check error.',
        });
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    void loadVendors().catch((error) => {
      setSessionState({
        status: 'error',
        detail: error instanceof Error ? error.message : 'Unknown vendor loading error.',
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
      description: locale === 'fi'
        ? 'Valitse toimittaja, esitäytä testitunnukset ja käynnistä vaiheittainen työnkulku.'
        : 'Choose the vendor, seed test credentials, and start the paginated workflow.',
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
  const navigationItems: NavigationItem[] = [
    {
      id: 'landing',
      label: t.navigation.landing,
    },
    ...stepPages.map((item) => ({
      id: item.id,
      label: item.label,
      disabled: item.disabled,
    })),
  ];
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
    onRefreshSession: () => void refreshSession(selectedVendor),
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