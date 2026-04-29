import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialSession, updateSessionStep, vendorCatalog, type NormalizedError, type OrchestrationSession, type PidRecord } from '@we-build/domain';

import App from '../src/App.js';

vi.mock('../src/QrCodePanel.js', () => ({
  QrCodePanel: ({ alt, value }: { alt: string; value: string }) => (
    <div data-testid="qr-code-panel">{`${alt}:${value}`}</div>
  ),
}));

function createReadySession(): OrchestrationSession {
  const session = createInitialSession('igrant-sandbox', '2026-04-22T10:00:00.000Z');
  session.sessionId = 'session-igrant';
  return session;
}

function createPendingPidSession(): OrchestrationSession {
  return updateSessionStep(createReadySession(), {
    step: 'pid',
    status: 'pending',
    data: {
      request: {
        protocol: 'oidc4vp',
        exchangeId: 'exchange-123',
        requestUri: 'https://verifier.example/request/123',
        openId4VpUri: 'openid4vp://?request_uri=https%3A%2F%2Fverifier.example%2Frequest%2F123',
        qrCodeValue: 'openid4vp://?request_uri=https%3A%2F%2Fverifier.example%2Frequest%2F123',
        presentationDefinitionId: 'pd-123',
      },
    },
    message: 'PID verification request created.',
  });
}

function createPendingPidSessionWithRequest(exchangeId: string): OrchestrationSession {
  return updateSessionStep(createReadySession(), {
    step: 'pid',
    status: 'pending',
    data: {
      request: {
        protocol: 'oidc4vp',
        exchangeId,
        requestUri: `https://verifier.example/request/${exchangeId}`,
        openId4VpUri: `openid4vp://?request_uri=${encodeURIComponent(`https://verifier.example/request/${exchangeId}`)}`,
        qrCodeValue: `openid4vp://?request_uri=${encodeURIComponent(`https://verifier.example/request/${exchangeId}`)}`,
        presentationDefinitionId: `pd-${exchangeId}`,
      },
    },
    message: 'PID verification request created.',
  });
}

function createPidSucceededBaseSession(): OrchestrationSession {
  const pidRecord: PidRecord = {
    givenName: 'Teemu',
    familyName: 'Tester',
    fullName: 'Teemu Tester',
    dateOfBirth: '1990-01-01',
    nationality: 'FI',
    residentCountry: 'FI',
    ageOver18: true,
    issuerName: 'Mock Issuer',
    issuerId: 'issuer-1',
    issuedAt: '2026-04-22T10:00:00.000Z',
    expiresAt: '2030-01-01T00:00:00.000Z',
  };

  return updateSessionStep(createReadySession(), {
    step: 'pid',
    status: 'succeeded',
    data: {
      record: pidRecord,
    },
    message: 'PID credential data received from the wallet.',
  });
}

function createSucceededPidSession(): OrchestrationSession {
  return createPidSucceededBaseSession();
}

function createFailedPidSession(): OrchestrationSession {
  const error: NormalizedError = {
    code: 'IGRANT_PID_VERIFICATION_FAILED',
    message: 'PID collection was received by the verifier, but credential verification failed.',
    retryable: false,
    source: 'vendor-adapter',
  };

  return updateSessionStep(createPendingPidSession(), {
    step: 'pid',
    status: 'failed',
    error,
    message: error.message,
  });
}

function createPendingPoaSession(): OrchestrationSession {
  return updateSessionStep(createPidSucceededBaseSession(), {
    step: 'poa',
    status: 'pending',
    data: {
      request: {
        protocol: 'oidc4vp',
        exchangeId: 'exchange-456',
        requestUri: 'https://verifier.example/request/456',
        openId4VpUri: 'openid4vp://?request_uri=https%3A%2F%2Fverifier.example%2Frequest%2F456',
        qrCodeValue: 'openid4vp://?request_uri=https%3A%2F%2Fverifier.example%2Frequest%2F456',
        presentationDefinitionId: 'pd-456',
      },
    },
    message: 'PoA verification request created.',
  });
}

function createFailedPoaSession(): OrchestrationSession {
  const error: NormalizedError = {
    code: 'IGRANT_POA_VERIFICATION_FAILED',
    message: 'PoA collection was received by the verifier, but credential verification failed.',
    retryable: false,
    source: 'vendor-adapter',
  };

  return updateSessionStep(createPendingPoaSession(), {
    step: 'poa',
    status: 'failed',
    error,
    message: error.message,
  });
}

function createPendingEuccSession(): OrchestrationSession {
  return updateSessionStep(createPidSucceededBaseSession(), {
    step: 'eucc',
    status: 'pending',
    data: {
      request: {
        protocol: 'oidc4vp',
        exchangeId: 'exchange-789',
        requestUri: 'https://verifier.example/request/789',
        openId4VpUri: 'openid4vp://?request_uri=https%3A%2F%2Fverifier.example%2Frequest%2F789',
        qrCodeValue: 'openid4vp://?request_uri=https%3A%2F%2Fverifier.example%2Frequest%2F789',
        presentationDefinitionId: 'pd-789',
      },
    },
    message: 'EUCC verification request created.',
  });
}

function createFailedEuccSession(): OrchestrationSession {
  const error: NormalizedError = {
    code: 'IGRANT_EUCC_VERIFICATION_FAILED',
    message: 'EUCC collection was received by the verifier, but credential verification failed.',
    retryable: false,
    source: 'vendor-adapter',
  };

  return updateSessionStep(createPendingEuccSession(), {
    step: 'eucc',
    status: 'failed',
    error,
    message: error.message,
  });
}

function createReviewReadySession(): OrchestrationSession {
  const session = createInitialSession('igrant-sandbox', '2026-04-22T10:00:00.000Z');
  session.sessionId = 'session-igrant';

  const withPid = updateSessionStep(session, {
    step: 'pid',
    status: 'succeeded',
    data: {
      record: {
        givenName: 'Teemu',
        familyName: 'Tester',
        fullName: 'Teemu Tester',
        dateOfBirth: '1990-01-01',
        nationality: 'FI',
        residentCountry: 'FI',
        ageOver18: true,
        issuerName: 'Mock Issuer',
        issuerId: 'issuer-1',
        issuedAt: '2026-04-22T10:00:00.000Z',
        expiresAt: '2030-01-01T00:00:00.000Z',
      },
    },
  });

  const withPoa = updateSessionStep(withPid, {
    step: 'poa',
    status: 'succeeded',
    data: {
      record: {
        companyId: 'FIHPR.2468135-7',
        companyName: 'Teemun Tomaatit Oy',
        principalName: 'Teemun Tomaatit Oy',
        attorneyName: 'Teemu Tester',
        attorneyDateOfBirth: '1990-01-01',
        scope: ['vat-filing'],
        substitutionAllowed: false,
        validFrom: '2026-04-21',
        validUntil: '2030-01-01',
        lawJurisdiction: 'FI',
        signingPlace: 'Tampere',
        signingDate: '2026-04-21',
      },
    },
  });

  const withEucc = updateSessionStep(withPoa, {
    step: 'eucc',
    status: 'succeeded',
    data: {
      record: {
        companyId: 'FIHPR.2468135-7',
        companyName: 'Teemun Tomaatit Oy',
        legalForm: 'Oy',
        registrationMemberState: 'FI',
        registeredAddress: 'Tomaattikuja 7; 33100 Tampere; Finland',
        registrationDate: '2020-03-15',
        legalPersonStatus: 'active',
        activityCodes: ['01.13'],
        representativeNames: ['Teemu Testi'],
      },
    },
  });

  return updateSessionStep(withEucc, {
    step: 'review',
    status: 'succeeded',
    data: {
      person: withEucc.pid.data!.record!,
      company: {
        companyId: 'FIHPR.2468135-7',
        companyName: 'Teemun Tomaatit Oy',
        legalForm: 'Oy',
        jurisdiction: 'FI',
        registeredOffice: 'Tomaattikuja 7; 33100 Tampere; Finland',
      },
      poa: withEucc.poa.data!.record!,
      eucc: withEucc.eucc.data!.record!,
      vatAttestation: {
        vatId: 'FI24681357',
        administrativeUnitName: 'Teemun Tomaatit Oy Tampere Operations',
        administrativeUnitType: 'head_office',
        economicOperatorId: 'FIHPR.2468135-7',
        economicOperatorName: 'Teemun Tomaatit Oy',
        issuingCountry: 'FI',
        issuingOrganisation: 'Finnish Tax Administration',
        attestationIssuingOrganisation: 'Finnish Tax Administration Digital Credentials Service',
        issuedAt: '2026-04-21',
      },
      assembledAt: '2026-04-22T10:05:00.000Z',
    },
  });
}

function createReviewPendingAssemblySession(): OrchestrationSession {
  const session = createInitialSession('igrant-sandbox', '2026-04-22T10:00:00.000Z');
  session.sessionId = 'session-igrant';

  const withPid = updateSessionStep(session, {
    step: 'pid',
    status: 'succeeded',
    data: {
      record: {
        givenName: 'Teemu',
        familyName: 'Tester',
        fullName: 'Teemu Tester',
        dateOfBirth: '1990-01-01',
        nationality: 'FI',
        residentCountry: 'FI',
        ageOver18: true,
        issuerName: 'Mock Issuer',
        issuerId: 'issuer-1',
        issuedAt: '2026-04-22T10:00:00.000Z',
        expiresAt: '2030-01-01T00:00:00.000Z',
      },
    },
  });

  const withPoa = updateSessionStep(withPid, {
    step: 'poa',
    status: 'succeeded',
    data: {
      record: {
        companyId: 'FIHPR.2468135-7',
        companyName: 'Teemun Tomaatit Oy',
        principalName: 'Teemun Tomaatit Oy',
        attorneyName: 'Teemu Tester',
        attorneyDateOfBirth: '1990-01-01',
        scope: ['vat-filing'],
        substitutionAllowed: false,
        validFrom: '2026-04-21',
        validUntil: '2030-01-01',
        lawJurisdiction: 'FI',
        signingPlace: 'Tampere',
        signingDate: '2026-04-21',
      },
    },
  });

  return updateSessionStep(withPoa, {
    step: 'eucc',
    status: 'succeeded',
    data: {
      record: {
        companyId: 'FIHPR.2468135-7',
        companyName: 'Teemun Tomaatit Oy',
        legalForm: 'Oy',
        registrationMemberState: 'FI',
        registeredAddress: 'Tomaattikuja 7; 33100 Tampere; Finland',
        registrationDate: '2020-03-15',
        legalPersonStatus: 'active',
        activityCodes: ['01.13'],
        representativeNames: ['Teemu Testi'],
      },
    },
  });
}

function createPendingVatIssuanceSession(): OrchestrationSession {
  const reviewSession = createReviewReadySession();
  const attestation = reviewSession.review.data!.vatAttestation;

  return updateSessionStep(reviewSession, {
    step: 'vatIssuance',
    status: 'pending',
    data: {
      vatId: attestation.vatId,
      administrativeUnitName: attestation.administrativeUnitName,
      administrativeUnitType: attestation.administrativeUnitType,
      issuingCountry: attestation.issuingCountry,
      issuingOrganisation: attestation.issuingOrganisation,
      exchangeId: 'vat-exchange-1',
      status: 'pending',
      walletCredential: {
        credentialType: 'vat',
        label: 'iGrant VAT attestation',
        holderName: attestation.economicOperatorName,
        issuerName: attestation.issuingOrganisation,
        seededAt: '2026-04-22T10:06:00.000Z',
        status: 'offer-created',
        offer: {
          protocol: 'oid4vci',
          offerUri: 'openid-credential-offer://credential_offer_uri=https%3A%2F%2Fissuer.example%2Foffers%2Fvat-exchange-1',
          qrCodeValue: 'openid-credential-offer://credential_offer_uri=https%3A%2F%2Fissuer.example%2Foffers%2Fvat-exchange-1',
          referenceUri: 'https://issuer.example/offers/vat-exchange-1',
          exchangeId: 'vat-exchange-1',
          userPin: '1234',
        },
      },
    },
    message: 'VAT issuance started and is pending.',
  });
}

async function openJourneyPage(label: string): Promise<void> {
  await waitFor(() => {
    const targetButton = screen.queryByRole('button', { name: label })
      ?? screen.queryByRole('button', { name: `Open ${label} page` });

    expect(targetButton).toBeTruthy();
    expect(targetButton?.hasAttribute('disabled')).toBe(false);
  });

  const targetButton = screen.queryByRole('button', { name: label })
    ?? screen.getByRole('button', { name: `Open ${label} page` });

  fireEvent.click(targetButton);
}

describe('App polling', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('switches between page definitions through the shared navigation shell', async () => {
    const currentSession = createReviewReadySession();

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();

      if (url.endsWith('/health')) {
        return new Response(JSON.stringify({ status: 'ok', service: 'api' }), { status: 200 });
      }

      if (url.endsWith('/api/vendors')) {
        return new Response(JSON.stringify(vendorCatalog), { status: 200 });
      }

      if (url.includes('/api/sessions/session-igrant')) {
        return new Response(JSON.stringify(currentSession), { status: 200 });
      }

      if (url.endsWith('/api/sessions')) {
        return new Response(JSON.stringify(currentSession), { status: 200 });
      }

      throw new Error(`Unhandled fetch request: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Local VAT attestation test journey' })).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Start workflow' }).hasAttribute('disabled')).toBe(false);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Start workflow' }));

    expect(await screen.findByRole('heading', { name: 'PID identification', level: 2 })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Fail' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Local VAT attestation test journey' })).toBeNull();

    await openJourneyPage('Review');

    expect(await screen.findByRole('heading', { name: 'Review payload', level: 2 })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Landing' }));

    expect(await screen.findByRole('heading', { name: 'Local VAT attestation test journey' })).toBeTruthy();
  });

  it('stops polling after PID data has been received', async () => {
    let currentSession = createReadySession();
    let pidActionCalls = 0;

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';

      if (url.endsWith('/health') && method === 'GET') {
        return new Response(JSON.stringify({ status: 'ok', service: 'local-api' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.endsWith('/api/vendors') && method === 'GET') {
        return new Response(JSON.stringify(vendorCatalog), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.endsWith('/api/sessions') && method === 'POST') {
        currentSession = createReadySession();

        return new Response(JSON.stringify(currentSession), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.includes('/api/sessions/session-igrant/actions/pid') && method === 'POST') {
        pidActionCalls += 1;
        currentSession = pidActionCalls === 1 ? createPendingPidSession() : createSucceededPidSession();

        return new Response(JSON.stringify(currentSession), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      throw new Error(`Unhandled fetch ${method} ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    await openJourneyPage('Identification');

    const requestPidButton = await screen.findByRole('button', { name: 'Request PID' }, { timeout: 10000 });
    expect(screen.queryByRole('button', { name: 'Initiate company' })).toBeNull();
    fireEvent.click(requestPidButton);

    await waitFor(() => {
      expect(pidActionCalls).toBe(1);
      expect(screen.getByText('PID presentation request')).toBeTruthy();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });

    await waitFor(() => {
      expect(pidActionCalls).toBe(2);
      expect(screen.getByText('Teemu Tester')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Continue to next step' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Re-request PID' })).toBeTruthy();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });

    expect(pidActionCalls).toBe(2);
  });

  it('continues to the next step and can re-request PID after success', async () => {
    let currentSession = createSucceededPidSession();
    let patchCalls = 0;
    let requestCalls = 0;

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';

      if (url.endsWith('/health') && method === 'GET') {
        return new Response(JSON.stringify({ status: 'ok', service: 'local-api' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.endsWith('/api/vendors') && method === 'GET') {
        return new Response(JSON.stringify(vendorCatalog), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.endsWith('/api/sessions') && method === 'POST') {
        return new Response(JSON.stringify(currentSession), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.includes('/api/sessions/session-igrant/steps/pid') && method === 'PATCH') {
        patchCalls += 1;
        currentSession = createReadySession();

        return new Response(JSON.stringify(currentSession), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.includes('/api/sessions/session-igrant/actions/pid') && method === 'POST') {
        requestCalls += 1;
        currentSession = createPendingPidSessionWithRequest('exchange-rerequest');

        return new Response(JSON.stringify(currentSession), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      throw new Error(`Unhandled fetch ${method} ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    await openJourneyPage('Identification');

    expect(await screen.findByRole('button', { name: 'Continue to next step' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Re-request PID' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Continue to next step' }));

    expect(await screen.findByRole('heading', { name: 'PoA collection', level: 2 })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Identification' }));

    expect(await screen.findByRole('button', { name: 'Re-request PID' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Re-request PID' }));

    await waitFor(() => {
      expect(patchCalls).toBe(1);
      expect(requestCalls).toBe(1);
      expect(screen.getByText('PID presentation request')).toBeTruthy();
      expect(screen.getByText('exchange-rerequest')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
    });
  });

  it('starts a new session without letting stale polling update the app', async () => {
    let currentSession = createPendingPidSession();
    let createSessionCalls = 0;
    let pidActionCalls = 0;
    let cleanupCalls = 0;
    let resolvePendingPidPoll: ((response: Response) => void) | null = null;

    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';

      if (url.endsWith('/health') && method === 'GET') {
        return Promise.resolve(new Response(JSON.stringify({ status: 'ok', service: 'local-api' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }));
      }

      if (url.endsWith('/api/vendors') && method === 'GET') {
        return Promise.resolve(new Response(JSON.stringify(vendorCatalog), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }));
      }

      if (url.endsWith('/api/sessions') && method === 'POST') {
        createSessionCalls += 1;

        if (createSessionCalls === 1) {
          currentSession = createPendingPidSession();
        } else {
          currentSession = createReadySession();
          currentSession.sessionId = 'session-new';
        }

        return Promise.resolve(new Response(JSON.stringify(currentSession), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        }));
      }

      if (url.includes('/api/sessions/session-igrant/steps/pid/history') && method === 'DELETE') {
        cleanupCalls += 1;

        return Promise.resolve(new Response(null, {
          status: 204,
        }));
      }

      if (url.includes('/api/sessions/session-igrant/actions/pid') && method === 'POST') {
        pidActionCalls += 1;

        return new Promise<Response>((resolve) => {
          resolvePendingPidPoll = resolve;
        });
      }

      throw new Error(`Unhandled fetch ${method} ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    expect(await screen.findByText('session-igrant')).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });

    await waitFor(() => {
      expect(pidActionCalls).toBe(1);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Start new session' }));

    expect(await screen.findByText('session-new')).toBeTruthy();
    expect(cleanupCalls).toBe(1);

    act(() => {
      resolvePendingPidPoll?.(new Response(JSON.stringify(createSucceededPidSession()), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }));
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText('session-new')).toBeTruthy();
    expect(screen.queryByText('Teemu Tester')).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });

    expect(pidActionCalls).toBe(1);
  });

  it('stops PID polling and shows the verifier error after a failed wallet-side receive', async () => {
    let currentSession = createReadySession();
    let pidActionCalls = 0;

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';

      if (url.endsWith('/health') && method === 'GET') {
        return new Response(JSON.stringify({ status: 'ok', service: 'local-api' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.endsWith('/api/vendors') && method === 'GET') {
        return new Response(JSON.stringify(vendorCatalog), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.endsWith('/api/sessions') && method === 'POST') {
        currentSession = createReadySession();

        return new Response(JSON.stringify(currentSession), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.includes('/api/sessions/session-igrant/actions/pid') && method === 'POST') {
        pidActionCalls += 1;
        currentSession = pidActionCalls === 1 ? createPendingPidSession() : createFailedPidSession();

        return new Response(JSON.stringify(currentSession), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      throw new Error(`Unhandled fetch ${method} ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    await openJourneyPage('Identification');

    const requestPidButton = await screen.findByRole('button', { name: 'Request PID' }, { timeout: 10000 });
    fireEvent.click(requestPidButton);

    await waitFor(() => {
      expect(pidActionCalls).toBe(1);
      expect(screen.getByText('PID presentation request')).toBeTruthy();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });

    await waitFor(() => {
      expect(pidActionCalls).toBe(2);
      expect(screen.getAllByText('PID collection was received by the verifier, but credential verification failed.').length).toBeGreaterThan(0);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });

    expect(pidActionCalls).toBe(2);
  });

  it('retries a pending PID request by stopping the old poll and creating a fresh request', async () => {
    let currentSession = createPendingPidSessionWithRequest('exchange-old');
    let createRequestCalls = 0;
    let cleanupCalls = 0;
    let pollCalls = 0;
    let resolvePendingPidPoll: ((response: Response) => void) | null = null;

    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';

      if (url.endsWith('/health') && method === 'GET') {
        return Promise.resolve(new Response(JSON.stringify({ status: 'ok', service: 'local-api' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }));
      }

      if (url.endsWith('/api/vendors') && method === 'GET') {
        return Promise.resolve(new Response(JSON.stringify(vendorCatalog), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }));
      }

      if (url.endsWith('/api/sessions') && method === 'POST') {
        return Promise.resolve(new Response(JSON.stringify(currentSession), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        }));
      }

      if (url.includes('/api/sessions/session-igrant/steps/pid/history') && method === 'DELETE') {
        cleanupCalls += 1;

        return Promise.resolve(new Response(null, {
          status: 204,
        }));
      }

      if (url.includes('/api/sessions/session-igrant/actions/pid') && method === 'POST') {
        const payload = init?.body ? JSON.parse(String(init.body)) as { simulationMode?: string } : {};

        if (payload.simulationMode) {
          createRequestCalls += 1;
          currentSession = createPendingPidSessionWithRequest('exchange-new');

          return Promise.resolve(new Response(JSON.stringify(currentSession), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }));
        }

        pollCalls += 1;

        if (pollCalls === 1) {
          return new Promise<Response>((resolve) => {
            resolvePendingPidPoll = resolve;
          });
        }

        return Promise.resolve(new Response(JSON.stringify(createSucceededPidSession()), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }));
      }

      throw new Error(`Unhandled fetch ${method} ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    await openJourneyPage('Identification');

    expect(await screen.findByRole('button', { name: 'Retry' })).toBeTruthy();
    expect(screen.getByText('exchange-old')).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });

    await waitFor(() => {
      expect(pollCalls).toBe(1);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => {
      expect(createRequestCalls).toBe(1);
      expect(cleanupCalls).toBe(1);
      expect(screen.getByText('exchange-new')).toBeTruthy();
    });

    act(() => {
      resolvePendingPidPoll?.(new Response(JSON.stringify(createSucceededPidSession()), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }));
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText('exchange-new')).toBeTruthy();
    expect(screen.queryByText('Teemu Tester')).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });

    await waitFor(() => {
      expect(pollCalls).toBe(2);
      expect(screen.getByText('Teemu Tester')).toBeTruthy();
    });
  });

  it('cancels a pending PID request by stopping polling and restoring the initial state', async () => {
    let currentSession = createPendingPidSessionWithRequest('exchange-old');
    let pollCalls = 0;
    let patchCalls = 0;
    let cleanupCalls = 0;
    let resolvePendingPidPoll: ((response: Response) => void) | null = null;

    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';

      if (url.endsWith('/health') && method === 'GET') {
        return Promise.resolve(new Response(JSON.stringify({ status: 'ok', service: 'local-api' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }));
      }

      if (url.endsWith('/api/vendors') && method === 'GET') {
        return Promise.resolve(new Response(JSON.stringify(vendorCatalog), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }));
      }

      if (url.endsWith('/api/sessions') && method === 'POST') {
        return Promise.resolve(new Response(JSON.stringify(currentSession), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        }));
      }

      if (url.includes('/api/sessions/session-igrant/steps/pid/history') && method === 'DELETE') {
        cleanupCalls += 1;

        return Promise.resolve(new Response(null, {
          status: 204,
        }));
      }

      if (url.includes('/api/sessions/session-igrant/steps/pid') && method === 'PATCH') {
        patchCalls += 1;
        currentSession = createReadySession();

        return Promise.resolve(new Response(JSON.stringify(currentSession), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }));
      }

      if (url.includes('/api/sessions/session-igrant/actions/pid') && method === 'POST') {
        pollCalls += 1;

        return new Promise<Response>((resolve) => {
          resolvePendingPidPoll = resolve;
        });
      }

      throw new Error(`Unhandled fetch ${method} ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    await openJourneyPage('Identification');

    expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
    expect(screen.getByText('exchange-old')).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });

    await waitFor(() => {
      expect(pollCalls).toBe(1);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(cleanupCalls).toBe(1);
      expect(patchCalls).toBe(1);
      expect(screen.getByRole('button', { name: 'Request PID' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
      expect(screen.queryByText('PID presentation request')).toBeNull();
    });

    act(() => {
      resolvePendingPidPoll?.(new Response(JSON.stringify(createSucceededPidSession()), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }));
    });

    await act(async () => {
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(10000);
    });

    expect(screen.queryByText('Teemu Tester')).toBeNull();
    expect(pollCalls).toBe(1);
  });

  it('starts a new session after deleting pending VAT issuance history', async () => {
    let currentSession = createPendingVatIssuanceSession();
    let createSessionCalls = 0;
    let cleanupCalls = 0;
    let issuancePollCalls = 0;
    let resolvePendingIssuancePoll: ((response: Response) => void) | null = null;

    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';

      if (url.endsWith('/health') && method === 'GET') {
        return Promise.resolve(new Response(JSON.stringify({ status: 'ok', service: 'local-api' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }));
      }

      if (url.endsWith('/api/vendors') && method === 'GET') {
        return Promise.resolve(new Response(JSON.stringify(vendorCatalog), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }));
      }

      if (url.endsWith('/api/sessions') && method === 'POST') {
        createSessionCalls += 1;

        if (createSessionCalls === 1) {
          return Promise.resolve(new Response(JSON.stringify(currentSession), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
          }));
        }

        currentSession = createReadySession();
        currentSession.sessionId = 'session-new';

        return Promise.resolve(new Response(JSON.stringify(currentSession), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        }));
      }

      if (url.includes('/api/sessions/session-igrant/steps/vatIssuance/history') && method === 'DELETE') {
        cleanupCalls += 1;

        return Promise.resolve(new Response(null, {
          status: 204,
        }));
      }

      if (url.includes('/api/sessions/session-igrant/actions/issuanceStatus') && method === 'POST') {
        issuancePollCalls += 1;

        return new Promise<Response>((resolve) => {
          resolvePendingIssuancePoll = resolve;
        });
      }

      throw new Error(`Unhandled fetch ${method} ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    expect(await screen.findByText('session-igrant')).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });

    await waitFor(() => {
      expect(issuancePollCalls).toBe(1);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Start new session' }));

    expect(await screen.findByText('session-new')).toBeTruthy();
    expect(cleanupCalls).toBe(1);

    act(() => {
      resolvePendingIssuancePoll?.(new Response(JSON.stringify(createPendingVatIssuanceSession()), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }));
    });

    await act(async () => {
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(30000);
    });

    expect(screen.getByText('session-new')).toBeTruthy();
    expect(issuancePollCalls).toBe(1);
  });

  it('stops PoA polling and shows the verifier error after a failed wallet-side receive', async () => {
    let currentSession = createPendingPoaSession();
    let poaActionCalls = 0;

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';

      if (url.endsWith('/health') && method === 'GET') {
        return new Response(JSON.stringify({ status: 'ok', service: 'local-api' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.endsWith('/api/vendors') && method === 'GET') {
        return new Response(JSON.stringify(vendorCatalog), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.endsWith('/api/sessions') && method === 'POST') {
        currentSession = createPendingPoaSession();

        return new Response(JSON.stringify(currentSession), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.includes('/api/sessions/session-igrant/actions/poa') && method === 'POST') {
        poaActionCalls += 1;
        currentSession = createFailedPoaSession();

        return new Response(JSON.stringify(currentSession), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      throw new Error(`Unhandled fetch ${method} ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    await openJourneyPage('Mandate');

    expect(await screen.findByRole('button', { name: 'Retry' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText('PoA presentation request')).toBeTruthy();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });

    await waitFor(() => {
      expect(poaActionCalls).toBe(1);
      expect(screen.getAllByText('PoA collection was received by the verifier, but credential verification failed.').length).toBeGreaterThan(0);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });

    expect(poaActionCalls).toBe(1);
  });

  it('stops EUCC polling and shows the verifier error after a failed wallet-side receive', async () => {
    let currentSession = createPendingEuccSession();
    let euccActionCalls = 0;

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';

      if (url.endsWith('/health') && method === 'GET') {
        return new Response(JSON.stringify({ status: 'ok', service: 'local-api' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.endsWith('/api/vendors') && method === 'GET') {
        return new Response(JSON.stringify(vendorCatalog), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.endsWith('/api/sessions') && method === 'POST') {
        currentSession = createPendingEuccSession();

        return new Response(JSON.stringify(currentSession), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.includes('/api/sessions/session-igrant/actions/eucc') && method === 'POST') {
        euccActionCalls += 1;
        currentSession = createFailedEuccSession();

        return new Response(JSON.stringify(currentSession), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      throw new Error(`Unhandled fetch ${method} ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    await openJourneyPage('Company');

    expect(await screen.findByRole('button', { name: 'Retry' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText('EUCC presentation request')).toBeTruthy();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });

    await waitFor(() => {
      expect(euccActionCalls).toBe(1);
      expect(screen.getAllByText('EUCC collection was received by the verifier, but credential verification failed.').length).toBeGreaterThan(0);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });

    expect(euccActionCalls).toBe(1);
  });

  it('shows the matched VAT attestation in the review panel before issuance', async () => {
    const currentSession = createReviewReadySession();

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';

      if (url.endsWith('/health') && method === 'GET') {
        return new Response(JSON.stringify({ status: 'ok', service: 'local-api' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.endsWith('/api/vendors') && method === 'GET') {
        return new Response(JSON.stringify(vendorCatalog), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.endsWith('/api/sessions') && method === 'POST') {
        return new Response(JSON.stringify(currentSession), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      throw new Error(`Unhandled fetch ${method} ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    await openJourneyPage('Review');

    expect(await screen.findByText('Matched VAT attestation')).toBeTruthy();
    expect(screen.getByText('FI24681357')).toBeTruthy();
    expect(screen.getByText('Teemun Tomaatit Oy Tampere Operations')).toBeTruthy();
    expect(screen.getByText('Matched from the verified EUCC company before issuance.')).toBeTruthy();
  });

  it('hides the matched VAT attestation block while keeping issuance actions on the issuance page', async () => {
    const currentSession = createReviewReadySession();

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';

      if (url.endsWith('/health') && method === 'GET') {
        return new Response(JSON.stringify({ status: 'ok', service: 'local-api' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.endsWith('/api/vendors') && method === 'GET') {
        return new Response(JSON.stringify(vendorCatalog), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.endsWith('/api/sessions') && method === 'POST') {
        return new Response(JSON.stringify(currentSession), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      throw new Error(`Unhandled fetch ${method} ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    await openJourneyPage('Issuance');

    await screen.findByRole('button', { name: 'Submit VAT issuance' });
    expect(screen.queryByText('Matched VAT attestation')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Person' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Company' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'PoA' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'EUCC' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Submit VAT issuance' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Restart issuance' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Refresh issuance status' })).toBeNull();
  });

  it('shows the VAT issuance QR code and exchange details when an offer is pending', async () => {
    const currentSession = createPendingVatIssuanceSession();

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';

      if (url.endsWith('/health') && method === 'GET') {
        return new Response(JSON.stringify({ status: 'ok', service: 'local-api' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.endsWith('/api/vendors') && method === 'GET') {
        return new Response(JSON.stringify(vendorCatalog), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.endsWith('/api/sessions') && method === 'POST') {
        return new Response(JSON.stringify(currentSession), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      throw new Error(`Unhandled fetch ${method} ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    await openJourneyPage('Issuance');

    expect(await screen.findByText('Issuance details')).toBeTruthy();
    expect(screen.getAllByText('vat-exchange-1').length).toBeGreaterThan(0);
    expect(screen.getByText('1234')).toBeTruthy();
    expect(screen.getByText('iGrant VAT attestation')).toBeTruthy();
    expect(screen.getByTestId('qr-code-panel').textContent).toContain('iGrant VAT attestation OID4VCI offer:openid-credential-offer://credential_offer_uri=https%3A%2F%2Fissuer.example%2Foffers%2Fvat-exchange-1');
    expect(screen.getByRole('link', { name: 'Open OID4VCI deep-link' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open raw offer URL' })).toBeTruthy();
  });

  it('restarts VAT issuance by resetting the step and immediately submitting a fresh issuance request', async () => {
    let currentSession = createPendingVatIssuanceSession();
    let cleanupCalls = 0;
    let resetCalls = 0;
    let issuanceActionCalls = 0;

    const restartedSession = updateSessionStep(createReviewReadySession(), {
      step: 'vatIssuance',
      status: 'pending',
      data: {
        vatId: 'FI24681357',
        administrativeUnitName: 'Restarted VAT issuance unit',
        administrativeUnitType: 'head_office',
        issuingCountry: 'FI',
        issuingOrganisation: 'Finnish Tax Administration',
        exchangeId: 'vat-exchange-2',
        status: 'pending',
        walletCredential: {
          credentialType: 'vat',
          label: 'iGrant VAT attestation',
          holderName: 'Teemun Tomaatit Oy',
          issuerName: 'Finnish Tax Administration',
          seededAt: '2026-04-22T10:08:00.000Z',
          status: 'offer-created',
          offer: {
            protocol: 'oid4vci',
            offerUri: 'openid-credential-offer://credential_offer_uri=https%3A%2F%2Fissuer.example%2Foffers%2Fvat-exchange-2',
            qrCodeValue: 'openid-credential-offer://credential_offer_uri=https%3A%2F%2Fissuer.example%2Foffers%2Fvat-exchange-2',
            referenceUri: 'https://issuer.example/offers/vat-exchange-2',
            exchangeId: 'vat-exchange-2',
            userPin: '5678',
          },
        },
      },
      message: 'VAT issuance restarted and is pending.',
    });

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';

      if (url.endsWith('/health') && method === 'GET') {
        return new Response(JSON.stringify({ status: 'ok', service: 'local-api' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.endsWith('/api/vendors') && method === 'GET') {
        return new Response(JSON.stringify(vendorCatalog), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.endsWith('/api/sessions') && method === 'POST') {
        return new Response(JSON.stringify(currentSession), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.includes('/api/sessions/session-igrant/steps/vatIssuance/history') && method === 'DELETE') {
        cleanupCalls += 1;

        return new Response(null, { status: 204 });
      }

      if (url.includes('/api/sessions/session-igrant/steps/vatIssuance') && method === 'PATCH') {
        resetCalls += 1;
        currentSession = updateSessionStep(currentSession, {
          step: 'vatIssuance',
          status: 'ready',
          message: 'VAT issuance reset before restart.',
        });

        return new Response(JSON.stringify(currentSession), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.includes('/api/sessions/session-igrant/actions/vatIssuance') && method === 'POST') {
        issuanceActionCalls += 1;
        currentSession = restartedSession;

        return new Response(JSON.stringify(currentSession), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      throw new Error(`Unhandled fetch ${method} ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    await openJourneyPage('Issuance');

    fireEvent.click(await screen.findByRole('button', { name: 'Restart issuance' }));

    await waitFor(() => {
      expect(cleanupCalls).toBe(1);
      expect(resetCalls).toBe(1);
      expect(issuanceActionCalls).toBe(1);
      expect(screen.getAllByText('vat-exchange-2').length).toBeGreaterThan(0);
      expect(screen.getByText('5678')).toBeTruthy();
    });
  });

  it('assembles the review payload automatically when the review step opens', async () => {
    let currentSession = createReviewPendingAssemblySession();
    let reviewActionCalls = 0;

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';

      if (url.endsWith('/health') && method === 'GET') {
        return new Response(JSON.stringify({ status: 'ok', service: 'local-api' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.endsWith('/api/vendors') && method === 'GET') {
        return new Response(JSON.stringify(vendorCatalog), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.endsWith('/api/sessions') && method === 'POST') {
        return new Response(JSON.stringify(currentSession), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.includes('/api/sessions/session-igrant/actions/review') && method === 'POST') {
        reviewActionCalls += 1;
        currentSession = createReviewReadySession();

        return new Response(JSON.stringify(currentSession), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      throw new Error(`Unhandled fetch ${method} ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    await openJourneyPage('Review');

    await waitFor(() => {
      expect(reviewActionCalls).toBe(1);
      expect(screen.getByText('Matched VAT attestation')).toBeTruthy();
    });

    expect(screen.queryByRole('button', { name: 'Assemble review' })).toBeNull();
  });

  it('gates future pages until workflow dependencies are ready', async () => {
    const currentSession = createReadySession();

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';

      if (url.endsWith('/health') && method === 'GET') {
        return new Response(JSON.stringify({ status: 'ok', service: 'local-api' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.endsWith('/api/vendors') && method === 'GET') {
        return new Response(JSON.stringify(vendorCatalog), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.endsWith('/api/sessions') && method === 'POST') {
        return new Response(JSON.stringify(currentSession), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      throw new Error(`Unhandled fetch ${method} ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    await openJourneyPage('Identification');

    expect(screen.queryByRole('button', { name: 'Continue to next step' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'PID collection surface', level: 3 })).toBeNull();
    expect(screen.queryByText('EUCC presentation request')).toBeNull();
  });

});