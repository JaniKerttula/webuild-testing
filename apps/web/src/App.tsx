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
} from '@we-build/domain';

import { AppShell, type NavigationItem } from './components/AppShell.js';
import { LandingPage } from './pages/LandingPage.js';
import { WorkflowStepPage } from './pages/WorkflowStepPage.js';
import { actionLabels } from './workflowUi.js';
import type { HealthState, JourneyNavigationItem, JourneyPageId, SessionState } from './pages/workflow/types.js';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

const journeyNavigationItems: JourneyNavigationItem[] = [
  {
    id: 'landing',
    label: 'Landing',
    description: 'Choose the vendor, seed test credentials, and start the paginated workflow.',
  },
  ...workflowStepDefinitions.map((step, index) => ({
    id: step.key,
    label: step.key === 'vatIssuance' ? 'Issuance' : step.title.replace(/ collection| payload| identification/, ''),
    description: step.summary,
    stepKey: step.key,
    stepNumber: index + 1,
  })),
];

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
  const [vendorOptions, setVendorOptions] = useState<VendorDefinition[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<VendorId>('igrant-sandbox');
  const [currentPageId, setCurrentPageId] = useState<JourneyPageId>('landing');
  const [session, setSession] = useState<OrchestrationSession | null>(null);
  const [sessionState, setSessionState] = useState<SessionState>({
    status: 'idle',
    detail: 'No session loaded yet.',
  });
  const [health, setHealth] = useState<HealthState>({
    status: 'loading',
    detail: 'Checking local API health.',
  });
  const pollingGenerationRef = useRef(0);

  function invalidatePolling(): number {
    pollingGenerationRef.current += 1;
    return pollingGenerationRef.current;
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
      detail: 'Loading session from the local API.',
    });

    try {
      const nextSession = await loadSession(vendorId);
      setSession(nextSession);
      setSessionState({
        status: 'ready',
        detail: `Loaded session ${nextSession.sessionId}.`,
      });
    } catch (error) {
      setSession(null);
      setSessionState({
        status: 'error',
        detail: error instanceof Error ? error.message : 'Unknown session loading error.',
      });
    }
  }

  async function startNewSession(): Promise<void> {
    invalidatePolling();
    setSession(null);
    setSessionState({
      status: 'loading',
      detail: 'Creating a new session in the local API.',
    });

    try {
      const nextSession = await createSession(selectedVendor);
      setSession(nextSession);
      setSessionState({
        status: 'ready',
        detail: `Created session ${nextSession.sessionId}.`,
      });
    } catch (error) {
      setSessionState({
        status: 'error',
        detail: error instanceof Error ? error.message : 'Unknown session creation error.',
      });
    }
  }

  async function triggerAction(actionKey: SessionActionKey, simulationMode: AdapterSimulationMode = 'success'): Promise<void> {
    if (!session) {
      return;
    }

    setSessionState({
      status: 'loading',
      detail: `Running ${actionLabels[actionKey]} in ${simulationMode} mode.`,
    });

    try {
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
        detail: error instanceof Error ? error.message : 'Unknown action execution error.',
      });
    }
  }

  async function pollPendingPid(sessionId: string, pollingGeneration: number): Promise<void> {
    try {
      const response = await fetch(`${apiBaseUrl}/api/sessions/${sessionId}/actions/pid`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
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
          detail: 'PID credential data received from the wallet.',
        });
        return;
      }

      if (nextSession.pid.status === 'failed') {
        setSessionState({
          status: 'error',
          detail: nextSession.pid.error?.message ?? 'PID credential verification failed during wallet collection.',
        });
      }
    } catch (error) {
      if (pollingGeneration !== pollingGenerationRef.current) {
        return;
      }

      setSessionState({
        status: 'error',
        detail: error instanceof Error ? error.message : 'Unknown PID polling error.',
      });
    }
  }

  async function pollPendingPoa(sessionId: string, pollingGeneration: number): Promise<void> {
    try {
      const response = await fetch(`${apiBaseUrl}/api/sessions/${sessionId}/actions/poa`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
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
          detail: 'PoA credential data received from the wallet.',
        });
        return;
      }

      if (nextSession.poa.status === 'failed') {
        setSessionState({
          status: 'error',
          detail: nextSession.poa.error?.message ?? 'PoA credential verification failed during wallet collection.',
        });
      }
    } catch (error) {
      if (pollingGeneration !== pollingGenerationRef.current) {
        return;
      }

      setSessionState({
        status: 'error',
        detail: error instanceof Error ? error.message : 'Unknown PoA polling error.',
      });
    }
  }

  async function pollPendingEucc(sessionId: string, pollingGeneration: number): Promise<void> {
    try {
      const response = await fetch(`${apiBaseUrl}/api/sessions/${sessionId}/actions/eucc`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
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
      if (pollingGeneration !== pollingGenerationRef.current) {
        return;
      }

      setSessionState({
        status: 'error',
        detail: error instanceof Error ? error.message : 'Unknown EUCC polling error.',
      });
    }
  }

  async function pollPendingVatIssuance(sessionId: string, pollingGeneration: number): Promise<void> {
    try {
      const response = await fetch(`${apiBaseUrl}/api/sessions/${sessionId}/actions/issuanceStatus`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
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
      if (pollingGeneration !== pollingGenerationRef.current) {
        return;
      }

      setSessionState({
        status: 'error',
        detail: error instanceof Error ? error.message : 'Unknown VAT issuance polling error.',
      });
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
  }, [selectedVendor, session?.sessionId, session?.pid.status, session?.pid.data?.request?.exchangeId]);

  useEffect(() => {
    if (selectedVendor !== 'igrant-sandbox' || !session?.sessionId) {
      return;
    }

    const exchangeId = session.poa.data?.request?.exchangeId;

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
  }, [selectedVendor, session?.sessionId, session?.poa.status, session?.poa.data?.request?.exchangeId]);

  useEffect(() => {
    if (selectedVendor !== 'igrant-sandbox' || !session?.sessionId) {
      return;
    }

    const exchangeId = session.eucc.data?.request?.exchangeId;

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
  }, [selectedVendor, session?.sessionId, session?.eucc.status, session?.eucc.data?.request?.exchangeId]);

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
  const stepPages = journeyNavigationItems
    .filter((item) => item.id !== 'landing')
    .map((item) => ({
      ...item,
      disabled: isJourneyPageEnabled(session, item.id) === false,
    }));
  const navigationItems: NavigationItem[] = [
    {
      id: 'landing',
      label: 'Landing',
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
          stepLabel={workflowStepDefinitions[index].title}
          stepDescription={workflowStepDefinitions[index].summary}
          stepNumber={page.stepNumber!}
          stepCount={stepPages.length}
          stepPages={stepPages}
          onNavigate={setCurrentPageId}
          previousPageId={(() => {
            const availablePrevious = stepPages.slice(0, index).filter((item) => !item.disabled);
            return availablePrevious.length ? availablePrevious[availablePrevious.length - 1]!.id : 'landing';
          })()}
          nextPageId={stepPages.slice(index + 1).find((item) => !item.disabled)?.id}
        />
      ),
    })),
  ];
  const currentPage = pages.find((page) => page.id === currentPageId) ?? pages[0];

  return (
    <AppShell
      brandTitle="We Build Testing"
      navigationItems={navigationItems}
      currentPageId={currentPage.id}
      onNavigate={(pageId) => {
        if (!isWorkflowStepKey(pageId) || isJourneyPageEnabled(session, pageId)) {
          setCurrentPageId(pageId as JourneyPageId);
        }
      }}
      languageLinks={[
        { href: '#page-footer', label: 'FI' },
        { href: '#page-footer', label: 'EN', isCurrent: true },
      ]}
      footerLinks={[
        { href: '#session-overview', label: 'Data protection' },
        { href: '#journey-overview', label: 'Accessibility statement' },
        { href: '#status', label: 'Contact information' },
      ]}
    >
      {currentPage.render()}
    </AppShell>
  );
}