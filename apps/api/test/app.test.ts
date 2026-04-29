import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { NormalizedError, OrchestrationSession, PidRecord, PidStepData, VendorDefinition, WalletCredentialSummary, WorkflowStepKey } from '@we-build/domain';

import { createApp } from '../src/app.js';
import { createIgrantSandboxAdapter } from '../src/vendors/sandboxAdapter.js';
import { createMockLocalAdapter } from '../src/vendors/mockLocalAdapter.js';
import type { AdapterOperationResult, VendorAdapter } from '../src/vendors/contract.js';

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const baseDefinition: VendorDefinition = {
  id: 'mock-local',
  label: 'Test Vendor',
  description: 'Test vendor adapter.',
  badge: 'Test',
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
};

function notImplemented<T>(message: string): Promise<AdapterOperationResult<T>> {
  return Promise.resolve({
    status: 'failed',
    error: {
      code: 'NOT_IMPLEMENTED',
      message,
      retryable: false,
      source: 'vendor-adapter',
    },
    message,
  });
}

function createTestAdapter(requestPidImpl: VendorAdapter['requestPid']): VendorAdapter {
  return {
    definition: baseDefinition,
    seedWalletCredential: (_session: OrchestrationSession, _walletRole: 'personal' | 'company', _credentialType: 'pid' | 'poa' | 'eucc') =>
      notImplemented<WalletCredentialSummary>('Wallet seeding not used in this test.'),
    requestPid: requestPidImpl,
    requestPoa: (_session: OrchestrationSession) => notImplemented('PoA not used in this test.'),
    requestEucc: (_session: OrchestrationSession) => notImplemented('EUCC not used in this test.'),
    assembleReview: (_session: OrchestrationSession) => notImplemented('Review not used in this test.'),
    submitVatIssuance: (_session: OrchestrationSession) => notImplemented('VAT issuance not used in this test.'),
    readIssuanceStatus: (_session: OrchestrationSession) => notImplemented('Issuance status not used in this test.'),
    cleanupStepHistory: (_session: OrchestrationSession, _stepKey: WorkflowStepKey) => Promise.resolve({
      status: 'succeeded',
      message: 'Cleanup not used in this test.',
    }),
  };
}

describe('API hardening', () => {
  it('allows the 127.0.0.1 web dev origin by default', async () => {
    const app = createApp();

    const response = await request(app)
      .get('/health')
      .set('Origin', 'http://127.0.0.1:5173')
      .expect(200);

    expect(response.headers['access-control-allow-origin']).toBe('http://127.0.0.1:5173');
  });

  it('allows loopback dev origins on alternate ports by default', async () => {
    const app = createApp({ corsOrigin: [] });

    const response = await request(app)
      .get('/health')
      .set('Origin', 'http://127.0.0.1:5174')
      .expect(200);

    expect(response.headers['access-control-allow-origin']).toBe('http://127.0.0.1:5174');
  });

  it('rejects invalid simulation modes before calling the adapter', async () => {
    const app = createApp();

    const created = await request(app)
      .post('/api/sessions')
      .send({ vendorId: 'mock-local' })
      .expect(201);

    const response = await request(app)
      .post(`/api/sessions/${created.body.sessionId}/actions/pid`)
      .send({ simulationMode: 'invalid-mode' })
      .expect(400);

    expect(response.body.error).toContain('Invalid simulationMode');
  });

  it('retries retryable vendor failures and returns the recovered result', async () => {
    let attempts = 0;
    const retryableError: NormalizedError = {
      code: 'TRANSIENT_ERROR',
      message: 'Temporary vendor issue.',
      retryable: true,
      source: 'vendor-adapter',
    };
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
      issuedAt: '2026-04-21T10:00:00.000Z',
      expiresAt: '2030-01-01T00:00:00.000Z',
    };

    const adapter = createTestAdapter(async () => {
      attempts += 1;

      if (attempts === 1) {
        return {
          status: 'failed',
          error: retryableError,
          message: retryableError.message,
        };
      }

      return {
        status: 'succeeded',
        data: {
          record: pidRecord,
        },
        message: 'Recovered on retry.',
      };
    });

    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    const app = createApp({
      hasAdapter: (vendorId) => vendorId === 'mock-local',
      getAdapter: () => adapter,
      listAdapters: () => [adapter],
      logger,
      executionConfig: {
        timeoutMs: 50,
        retryCount: 1,
      },
    });

    const created = await request(app)
      .post('/api/sessions')
      .send({ vendorId: 'mock-local' })
      .expect(201);

    const response = await request(app)
      .post(`/api/sessions/${created.body.sessionId}/actions/pid`)
      .send({ simulationMode: 'success' })
      .expect(200);

    expect(attempts).toBe(2);
    expect(response.body.pid.status).toBe('succeeded');
    expect(response.body.pid.data.record.fullName).toBe('Teemu Tester');
    expect(logger.warn).toHaveBeenCalled();
  });

  it('marks the action as failed when the vendor call times out', async () => {
    const adapter = createTestAdapter(
      async () => new Promise<AdapterOperationResult<PidStepData>>(() => undefined),
    );

    const app = createApp({
      hasAdapter: (vendorId) => vendorId === 'mock-local',
      getAdapter: () => adapter,
      listAdapters: () => [adapter],
      executionConfig: {
        timeoutMs: 10,
        retryCount: 0,
      },
    });

    const created = await request(app)
      .post('/api/sessions')
      .send({ vendorId: 'mock-local' })
      .expect(201);

    const response = await request(app)
      .post(`/api/sessions/${created.body.sessionId}/actions/pid`)
      .send({ simulationMode: 'success' })
      .expect(200);

    expect(response.body.pid.status).toBe('failed');
    expect(response.body.pid.error.code).toBe('VENDOR_OPERATION_TIMEOUT');
  });

  it('normalizes mock adapter fixture data for PID and EUCC', async () => {
    const adapter = createMockLocalAdapter();
    const app = createApp({
      hasAdapter: (vendorId) => vendorId === 'mock-local',
      getAdapter: () => adapter,
      listAdapters: () => [adapter],
    });

    const created = await request(app)
      .post('/api/sessions')
      .send({ vendorId: 'mock-local' })
      .expect(201);

    const pidResponse = await request(app)
      .post(`/api/sessions/${created.body.sessionId}/actions/pid`)
      .send({ simulationMode: 'success' })
      .expect(200);

    expect(pidResponse.body.pid.data.record.fullName).toBeTruthy();
    expect(pidResponse.body.pid.data.record.issuerName).toBeTruthy();

    const euccResponse = await request(app)
      .post(`/api/sessions/${created.body.sessionId}/actions/eucc`)
      .send({ simulationMode: 'success' })
      .expect(200);

    expect(euccResponse.body.eucc.data.record.companyName).toBeTruthy();
    expect(Array.isArray(euccResponse.body.eucc.data.record.representativeNames)).toBe(true);
  });

  it('persists VAT wallet credentials returned by issuance actions into the company wallet', async () => {
    const adapter: VendorAdapter = {
      definition: baseDefinition,
      seedWalletCredential: (_session, _walletRole, _credentialType) => notImplemented('Wallet seeding not used in this test.'),
      requestPid: (_session) => notImplemented('PID not used in this test.'),
      requestPoa: (_session) => notImplemented('PoA not used in this test.'),
      requestEucc: (_session) => notImplemented('EUCC not used in this test.'),
      assembleReview: (_session) => notImplemented('Review not used in this test.'),
      submitVatIssuance: async () => ({
        status: 'pending',
        data: {
          vatId: 'FI24681357',
          administrativeUnitName: 'Teemun Tomaatit Oy Tampere Operations',
          administrativeUnitType: 'head_office',
          issuingCountry: 'FI',
          issuingOrganisation: 'Finnish Tax Administration',
          exchangeId: 'vat-exchange-1',
          status: 'pending',
          walletCredential: {
            credentialType: 'vat',
            label: 'iGrant VAT attestation',
            holderName: 'Teemun Tomaatit Oy',
            issuerName: 'Finnish Tax Administration',
            seededAt: '2026-04-22T10:10:00.000Z',
            status: 'offer-created',
            offer: {
              protocol: 'oid4vci',
              offerUri: 'openid-credential-offer://?credential_offer_uri=https%3A%2F%2Fissuer.example%2Fvat-offer',
              qrCodeValue: 'https://issuer.example/vat-offer',
              referenceUri: 'https://issuer.example/vat-offer',
              exchangeId: 'vat-exchange-1',
            },
          },
        },
        message: 'Started VAT issuance for wallet pickup.',
      }),
      readIssuanceStatus: (_session) => notImplemented('Issuance status not used in this test.'),
      cleanupStepHistory: (_session, _stepKey) => Promise.resolve({
        status: 'succeeded',
        message: 'Cleanup not used in this test.',
      }),
    };

    const app = createApp({
      hasAdapter: (vendorId) => vendorId === 'mock-local',
      getAdapter: () => adapter,
      listAdapters: () => [adapter],
    });

    const created = await request(app)
      .post('/api/sessions')
      .send({ vendorId: 'mock-local' })
      .expect(201);

    const response = await request(app)
      .post(`/api/sessions/${created.body.sessionId}/actions/vatIssuance`)
      .send({ simulationMode: 'success' })
      .expect(200);

    expect(response.body.vatIssuance.status).toBe('pending');
    expect(response.body.wallets.company.loadedCredentials).toHaveLength(1);
    expect(response.body.wallets.company.loadedCredentials[0].credentialType).toBe('vat');
    expect(response.body.wallets.company.loadedCredentials[0].offer.offerUri).toContain('vat-offer');
  });

  it('deletes step history through the adapter cleanup endpoint', async () => {
    const cleanupStepHistory = vi.fn(async () => ({
      status: 'succeeded' as const,
      message: 'Deleted remote history.',
    }));

    const adapter: VendorAdapter = {
      ...createTestAdapter(async () => notImplemented('PID not used in this test.')),
      cleanupStepHistory,
    };

    const app = createApp({
      hasAdapter: (vendorId) => vendorId === 'mock-local',
      getAdapter: () => adapter,
      listAdapters: () => [adapter],
    });

    const created = await request(app)
      .post('/api/sessions')
      .send({ vendorId: 'mock-local' })
      .expect(201);

    await request(app)
      .delete(`/api/sessions/${created.body.sessionId}/steps/pid/history`)
      .expect(204);

    expect(cleanupStepHistory).toHaveBeenCalledWith(expect.objectContaining({ sessionId: created.body.sessionId }), 'pid');
  });

  it('creates a pending PID OIDC4VP request from the action endpoint', async () => {
    process.env.IGRANT_API_KEY = 'test-key';
    process.env.IGRANT_AUTH_SCHEME = 'Bearer';
    process.env.IGRANT_BASE_URL = 'https://demo-api.igrant.io';
    process.env.IGRANT_PERSONAL_CREDENTIAL_DEFINITION_ID = 'pid-definition';

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ verifierGlobalConfiguration: [{}] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({
          credentialDefinition: {
            credentialDefinitions: [
              {
                id: 'pid-entry-id',
                vct: 'urn:we-build:credential:test-pid:1',
                claims: {
                  claims: [
                    { path: ['givenName'], mandatory: true },
                    { path: ['familyName'], mandatory: true },
                    { path: ['dateOfBirth'], mandatory: true },
                  ],
                },
              },
            ],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({
          presentationDefinition: {
            presentationDefinitionId: 'pd-123',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({
          verificationHistory: {
            presentationExchangeId: 'exchange-123',
            vpTokenQrCode: 'openid4vp://?request_uri=https%3A%2F%2Fverifier.example%2Frequest%2F123',
          },
        }),
      });

    vi.stubGlobal('fetch', fetchMock);

    const adapter = createIgrantSandboxAdapter();
    const app = createApp({
      hasAdapter: (vendorId) => vendorId === 'igrant-sandbox',
      getAdapter: () => adapter,
      listAdapters: () => [adapter],
    });

    const created = await request(app)
      .post('/api/sessions')
      .send({ vendorId: 'igrant-sandbox' })
      .expect(201);

    const response = await request(app)
      .post(`/api/sessions/${created.body.sessionId}/actions/pid`)
      .send({})
      .expect(200);

    expect(response.body.pid.status).toBe('pending');
    expect(response.body.pid.data.request.exchangeId).toBe('exchange-123');
    expect(response.body.pid.data.request.requestUri).toBe('https://verifier.example/request/123');
    expect(response.body.pid.data.request.openId4VpUri).toBe('openid4vp://?request_uri=https%3A%2F%2Fverifier.example%2Frequest%2F123');

    const [listUrl] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(listUrl).toBe('https://demo-api.igrant.io/v2/config/digital-wallet/openid/verifier/global-configurations');

    const [definitionUrl] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(definitionUrl).toBe('https://demo-api.igrant.io/v2/config/digital-wallet/openid/sdjwt/credential-definition/pid-definition');

    const [presentationDefinitionUrl, presentationDefinitionInit] = fetchMock.mock.calls[2] as [string, RequestInit];
    expect(presentationDefinitionUrl).toBe('https://demo-api.igrant.io/v2/config/digital-wallet/openid/sdjwt/presentation-definition');
    expect(JSON.parse(String(presentationDefinitionInit.body))).toMatchObject({
      label: expect.stringContaining(`We Build Testing PID verification ${created.body.sessionId}`),
      responseType: 'vp_token',
      responseMode: 'direct_post',
      clientIdScheme: 'redirect_uri',
    });

    const [verificationUrl, verificationInit] = fetchMock.mock.calls[3] as [string, RequestInit];
    expect(verificationUrl).toBe('https://demo-api.igrant.io/v3/config/digital-wallet/openid/sdjwt/verification/send');
    expect(JSON.parse(String(verificationInit.body))).toEqual({
      presentationDefinitionId: 'pd-123',
      requestByReference: true,
      urlPrefix: 'openid4vp://',
    });
  });

  it('polls pending PID verification and stores the received credential data', async () => {
    process.env.IGRANT_API_KEY = 'test-key';
    process.env.IGRANT_AUTH_SCHEME = 'Bearer';
    process.env.IGRANT_BASE_URL = 'https://demo-api.igrant.io';
    process.env.IGRANT_PERSONAL_CREDENTIAL_DEFINITION_ID = 'pid-definition';

    const sdJwtPayload = Buffer.from(JSON.stringify({ iss: 'issuer-1', _sd: [] })).toString('base64url');
    const disclosures = [
      ['salt', 'givenName', 'Teemu'],
      ['salt', 'familyName', 'Tester'],
      ['salt', 'ageOver18', true],
      ['salt', 'dateOfBirth', '1990-01-01'],
      ['salt', 'nationality', 'FI'],
      ['salt', 'residentCountry', 'FI'],
    ].map((value) => Buffer.from(JSON.stringify(value)).toString('base64url'));
    const sdJwt = `header.${sdJwtPayload}.signature~${disclosures.join('~')}`;

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ verifierGlobalConfiguration: [{}] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({
          credentialDefinition: {
            credentialDefinitions: [
              {
                id: 'pid-entry-id',
                vct: 'urn:we-build:credential:test-pid:1',
                claims: {
                  claims: [{ path: ['givenName'], mandatory: true }],
                },
              },
            ],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({
          presentationDefinition: {
            presentationDefinitionId: 'pd-123',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({
          verificationHistory: {
            presentationExchangeId: 'exchange-123',
            vpTokenQrCode: 'openid4vp://?request_uri=https%3A%2F%2Fverifier.example%2Frequest%2F123',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({
          verificationHistory: {
            presentationExchangeId: 'exchange-123',
            status: 'presentation_acked',
            verified: true,
            vpTokenResponse: {
              vp_token: sdJwt,
            },
          },
        }),
      });

    vi.stubGlobal('fetch', fetchMock);

    const adapter = createIgrantSandboxAdapter();
    const app = createApp({
      hasAdapter: (vendorId) => vendorId === 'igrant-sandbox',
      getAdapter: () => adapter,
      listAdapters: () => [adapter],
    });

    const created = await request(app)
      .post('/api/sessions')
      .send({ vendorId: 'igrant-sandbox' })
      .expect(201);

    await request(app)
      .post(`/api/sessions/${created.body.sessionId}/actions/pid`)
      .send({})
      .expect(200);

    const polled = await request(app)
      .post(`/api/sessions/${created.body.sessionId}/actions/pid`)
      .send({})
      .expect(200);

    expect(polled.body.pid.status).toBe('succeeded');
    expect(polled.body.pid.data.record.fullName).toBe('Teemu Tester');
    expect(polled.body.pid.data.record.dateOfBirth).toBe('1990-01-01');
  });

  it('fails pending PID verification when the verifier received the request but did not verify it', async () => {
    process.env.IGRANT_API_KEY = 'test-key';
    process.env.IGRANT_AUTH_SCHEME = 'Bearer';
    process.env.IGRANT_BASE_URL = 'https://demo-api.igrant.io';
    process.env.IGRANT_PERSONAL_CREDENTIAL_DEFINITION_ID = 'pid-definition';

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ verifierGlobalConfiguration: [{}] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({
          credentialDefinition: {
            credentialDefinitions: [
              {
                id: 'pid-entry-id',
                vct: 'urn:we-build:credential:test-pid:1',
                claims: {
                  claims: [{ path: ['givenName'], mandatory: true }],
                },
              },
            ],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({
          presentationDefinition: {
            presentationDefinitionId: 'pd-123',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({
          verificationHistory: {
            presentationExchangeId: 'exchange-123',
            vpTokenQrCode: 'openid4vp://?request_uri=https%3A%2F%2Fverifier.example%2Frequest%2F123',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({
          verificationHistory: {
            presentationExchangeId: 'exchange-123',
            status: 'presentation_acked',
            verified: false,
          },
        }),
      });

    vi.stubGlobal('fetch', fetchMock);

    const adapter = createIgrantSandboxAdapter();
    const app = createApp({
      hasAdapter: (vendorId) => vendorId === 'igrant-sandbox',
      getAdapter: () => adapter,
      listAdapters: () => [adapter],
    });

    const created = await request(app)
      .post('/api/sessions')
      .send({ vendorId: 'igrant-sandbox' })
      .expect(201);

    await request(app)
      .post(`/api/sessions/${created.body.sessionId}/actions/pid`)
      .send({})
      .expect(200);

    const polled = await request(app)
      .post(`/api/sessions/${created.body.sessionId}/actions/pid`)
      .send({})
      .expect(200);

    expect(polled.body.pid.status).toBe('failed');
    expect(polled.body.pid.error.code).toBe('IGRANT_PID_VERIFICATION_FAILED');
    expect(polled.body.pid.error.message).toContain('credential verification failed');
  });

  it('polls pending PoA verification and stores the received credential data', async () => {
    process.env.IGRANT_API_KEY = 'test-key';
    process.env.IGRANT_AUTH_SCHEME = 'Bearer';
    process.env.IGRANT_BASE_URL = 'https://demo-api.igrant.io';
    process.env.IGRANT_POA_CREDENTIAL_DEFINITION_ID = 'poa-definition';

    const sdJwtPayload = Buffer.from(JSON.stringify({ iss: 'issuer-1', _sd: [] })).toString('base64url');
    const disclosures = [
      ['salt', 'euid_reference', 'FI:1234567-8'],
      ['salt', 'company_statutory_full_name', 'We Build Oy'],
      ['salt', 'principal_full_name', 'We Build Oy'],
      ['salt', 'attorney_full_name', 'Teemu Tester'],
      ['salt', 'attorney_date_of_birth', '1990-01-01'],
      ['salt', 'validity_period_valid_from', '2026-04-21'],
      ['salt', 'validity_period_valid_until', '2030-01-01'],
      ['salt', 'applicable_law_jurisdiction', 'FI'],
      ['salt', 'signing_place', 'Helsinki'],
      ['salt', 'signing_date', '2026-04-21'],
      ['salt', 'scope_of_representation_power_of_substitution', 'not_allowed'],
      ['salt', 'scope_of_representation_powers', ['vat-filing', 'signing']],
    ].map((value) => Buffer.from(JSON.stringify(value)).toString('base64url'));
    const sdJwt = `header.${sdJwtPayload}.signature~${disclosures.join('~')}`;

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ verifierGlobalConfiguration: [{}] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({
          credentialDefinition: {
            credentialDefinitions: [
              {
                id: 'poa-entry-id',
                vct: 'urn:we-build:credential:test-poa:1',
                claims: {
                  claims: [{ path: ['attorneyName'], mandatory: true }],
                },
              },
            ],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({
          presentationDefinition: {
            presentationDefinitionId: 'pd-456',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({
          verificationHistory: {
            presentationExchangeId: 'exchange-456',
            vpTokenQrCode: 'openid4vp://?request_uri=https%3A%2F%2Fverifier.example%2Frequest%2F456',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({
          verificationHistory: {
            presentationExchangeId: 'exchange-456',
            status: 'presentation_acked',
            verified: true,
            vpTokenResponse: {
              vp_token: sdJwt,
            },
          },
        }),
      });

    vi.stubGlobal('fetch', fetchMock);

    const adapter = createIgrantSandboxAdapter();
    const app = createApp({
      hasAdapter: (vendorId) => vendorId === 'igrant-sandbox',
      getAdapter: () => adapter,
      listAdapters: () => [adapter],
    });

    const created = await request(app)
      .post('/api/sessions')
      .send({ vendorId: 'igrant-sandbox' })
      .expect(201);

    await request(app)
      .post(`/api/sessions/${created.body.sessionId}/actions/poa`)
      .send({})
      .expect(200);

    const polled = await request(app)
      .post(`/api/sessions/${created.body.sessionId}/actions/poa`)
      .send({})
      .expect(200);

    expect(polled.body.poa.status).toBe('succeeded');
    expect(polled.body.poa.data.record.attorneyName).toBe('Teemu Tester');
    expect(polled.body.poa.data.record.principalName).toBe('We Build Oy');
    expect(polled.body.poa.data.record.companyId).toBe('FI:1234567-8');
    expect(polled.body.poa.data.record.scope).toEqual(['vat-filing', 'signing']);
  });

  it('fails pending PoA verification when the verifier received the request but did not verify it', async () => {
    process.env.IGRANT_API_KEY = 'test-key';
    process.env.IGRANT_AUTH_SCHEME = 'Bearer';
    process.env.IGRANT_BASE_URL = 'https://demo-api.igrant.io';
    process.env.IGRANT_POA_CREDENTIAL_DEFINITION_ID = 'poa-definition';

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ verifierGlobalConfiguration: [{}] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({
          credentialDefinition: {
            credentialDefinitions: [
              {
                id: 'poa-entry-id',
                vct: 'urn:we-build:credential:test-poa:1',
                claims: {
                  claims: [{ path: ['attorneyName'], mandatory: true }],
                },
              },
            ],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({
          presentationDefinition: {
            presentationDefinitionId: 'pd-456',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({
          verificationHistory: {
            presentationExchangeId: 'exchange-456',
            vpTokenQrCode: 'openid4vp://?request_uri=https%3A%2F%2Fverifier.example%2Frequest%2F456',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({
          verificationHistory: {
            presentationExchangeId: 'exchange-456',
            status: 'presentation_acked',
            verified: false,
          },
        }),
      });

    vi.stubGlobal('fetch', fetchMock);

    const adapter = createIgrantSandboxAdapter();
    const app = createApp({
      hasAdapter: (vendorId) => vendorId === 'igrant-sandbox',
      getAdapter: () => adapter,
      listAdapters: () => [adapter],
    });

    const created = await request(app)
      .post('/api/sessions')
      .send({ vendorId: 'igrant-sandbox' })
      .expect(201);

    await request(app)
      .post(`/api/sessions/${created.body.sessionId}/actions/poa`)
      .send({})
      .expect(200);

    const polled = await request(app)
      .post(`/api/sessions/${created.body.sessionId}/actions/poa`)
      .send({})
      .expect(200);

    expect(polled.body.poa.status).toBe('failed');
    expect(polled.body.poa.error.code).toBe('IGRANT_POA_VERIFICATION_FAILED');
    expect(polled.body.poa.error.message).toContain('credential verification failed');
  });

  it('polls pending EUCC verification and stores the received credential data', async () => {
    process.env.IGRANT_API_KEY = 'test-key';
    process.env.IGRANT_AUTH_SCHEME = 'Bearer';
    process.env.IGRANT_BASE_URL = 'https://demo-api.igrant.io';
    process.env.IGRANT_EUCC_CREDENTIAL_DEFINITION_ID = 'eucc-definition';

    const verificationPayload = {
      legal_person_id: 'FIHPR.2468135-7',
      legal_person_name: 'Teemun Tomaatit Oy',
      legal_form_type: 'Oy',
      registration_member_state: 'FI',
      registered_address: {
        registered_address_full_address: 'Tomaattikuja 7; 33100 Tampere; Finland',
      },
      registration_date: '2020-03-15',
      legal_person_status: 'active',
      legal_person_activity: ['01.13', '46.31'],
      contact_point: {
        contact_email: 'info@teemuntomaatit.example',
        contact_page: 'https://teemuntomaatit.example',
      },
      legal_representative: [
        {
          legal_representative_natural_person: {
            legal_representative_natural_person_full_name: 'Teemu Testi',
          },
        },
      ],
    };

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ verifierGlobalConfiguration: [{}] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({
          credentialDefinition: {
            credentialDefinitions: [
              {
                id: 'eucc-entry-id',
                vct: 'urn:we-build:credential:test-eucc:1',
                claims: {
                  claims: [{ path: ['legal_person_name'], mandatory: true }],
                },
              },
            ],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({
          presentationDefinition: {
            presentationDefinitionId: 'pd-789',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({
          verificationHistory: {
            presentationExchangeId: 'exchange-789',
            vpTokenQrCode: 'openid4vp://?request_uri=https%3A%2F%2Fverifier.example%2Frequest%2F789',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({
          verificationHistory: {
            presentationExchangeId: 'exchange-789',
            status: 'presentation_acked',
            verified: true,
            vpTokenResponse: {
              vp_token: verificationPayload,
            },
          },
        }),
      });

    vi.stubGlobal('fetch', fetchMock);

    const adapter = createIgrantSandboxAdapter();
    const app = createApp({
      hasAdapter: (vendorId) => vendorId === 'igrant-sandbox',
      getAdapter: () => adapter,
      listAdapters: () => [adapter],
    });

    const created = await request(app)
      .post('/api/sessions')
      .send({ vendorId: 'igrant-sandbox' })
      .expect(201);

    await request(app)
      .post(`/api/sessions/${created.body.sessionId}/actions/eucc`)
      .send({})
      .expect(200);

    const polled = await request(app)
      .post(`/api/sessions/${created.body.sessionId}/actions/eucc`)
      .send({})
      .expect(200);

    expect(polled.body.eucc.status).toBe('succeeded');
    expect(polled.body.eucc.data.record.companyId).toBe('FIHPR.2468135-7');
    expect(polled.body.eucc.data.record.companyName).toBe('Teemun Tomaatit Oy');
    expect(polled.body.eucc.data.record.representativeNames).toEqual(['Teemu Testi']);
  });

  it('fails pending EUCC verification when the verifier received the request but did not verify it', async () => {
    process.env.IGRANT_API_KEY = 'test-key';
    process.env.IGRANT_AUTH_SCHEME = 'Bearer';
    process.env.IGRANT_BASE_URL = 'https://demo-api.igrant.io';
    process.env.IGRANT_EUCC_CREDENTIAL_DEFINITION_ID = 'eucc-definition';

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ verifierGlobalConfiguration: [{}] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({
          credentialDefinition: {
            credentialDefinitions: [
              {
                id: 'eucc-entry-id',
                vct: 'urn:we-build:credential:test-eucc:1',
                claims: {
                  claims: [{ path: ['legal_person_name'], mandatory: true }],
                },
              },
            ],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({
          presentationDefinition: {
            presentationDefinitionId: 'pd-789',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({
          verificationHistory: {
            presentationExchangeId: 'exchange-789',
            vpTokenQrCode: 'openid4vp://?request_uri=https%3A%2F%2Fverifier.example%2Frequest%2F789',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({
          verificationHistory: {
            presentationExchangeId: 'exchange-789',
            status: 'presentation_acked',
            verified: false,
          },
        }),
      });

    vi.stubGlobal('fetch', fetchMock);

    const adapter = createIgrantSandboxAdapter();
    const app = createApp({
      hasAdapter: (vendorId) => vendorId === 'igrant-sandbox',
      getAdapter: () => adapter,
      listAdapters: () => [adapter],
    });

    const created = await request(app)
      .post('/api/sessions')
      .send({ vendorId: 'igrant-sandbox' })
      .expect(201);

    await request(app)
      .post(`/api/sessions/${created.body.sessionId}/actions/eucc`)
      .send({})
      .expect(200);

    const polled = await request(app)
      .post(`/api/sessions/${created.body.sessionId}/actions/eucc`)
      .send({})
      .expect(200);

    expect(polled.body.eucc.status).toBe('failed');
    expect(polled.body.eucc.error.code).toBe('IGRANT_EUCC_VERIFICATION_FAILED');
    expect(polled.body.eucc.error.message).toContain('credential verification failed');
  });

  it('creates OID4VCI wallet offers for the iGrant vendor session', async () => {
    process.env.IGRANT_API_KEY = 'test-key';
    process.env.IGRANT_AUTH_SCHEME = 'Bearer';
    process.env.IGRANT_BASE_URL = 'https://demo-api.igrant.io';
    process.env.IGRANT_PERSONAL_CREDENTIAL_DEFINITION_ID = 'pid-definition';
    process.env.IGRANT_POA_CREDENTIAL_DEFINITION_ID = 'poa-definition';
    process.env.IGRANT_EUCC_CREDENTIAL_DEFINITION_ID = 'eucc-definition';

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({
          credentialDefinition: {
            credentialDefinitions: [
              {
                id: 'pid-entry-id',
              },
            ],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({
          credentialExchangeId: 'pid-exchange-1',
          credentialOfferUri: 'openid-credential-offer://?credential_offer_uri=https://issuer.example/pid-offer',
          credentialOffer: {
            credential_issuer: 'https://issuer.example',
            credentials: ['EmployeeIdentityCredential'],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({
          credentialDefinition: {
            credentialDefinitions: [
              {
                id: 'poa-entry-id',
              },
            ],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({
          credentialExchangeId: 'poa-exchange-1',
          credentialOfferUri: 'openid-credential-offer://poa-offer',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({
          credentialDefinition: {
            credentialDefinitions: [
              {
                id: 'eucc-entry-id',
              },
            ],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({
          credentialExchangeId: 'eucc-exchange-1',
          credentialOfferUri: 'openid-credential-offer://eucc-offer',
        }),
      });

    vi.stubGlobal('fetch', fetchMock);

    const adapter = createIgrantSandboxAdapter();
    const app = createApp({
      hasAdapter: (vendorId) => vendorId === 'igrant-sandbox',
      getAdapter: () => adapter,
      listAdapters: () => [adapter],
    });

    const created = await request(app)
      .post('/api/sessions')
      .send({ vendorId: 'igrant-sandbox' })
      .expect(201);

    const pidSeedResponse = await request(app)
      .post(`/api/sessions/${created.body.sessionId}/wallets/personal/credentials`)
      .send({ credentialType: 'pid' })
      .expect(200);

    expect(pidSeedResponse.body.wallets.personal.loadedCredentials).toEqual([
      expect.objectContaining({
        credentialType: 'pid',
        status: 'offer-created',
        offer: expect.objectContaining({
          exchangeId: 'pid-exchange-1',
          offerUri: 'openid-credential-offer://?credential_offer_uri=https%3A%2F%2Fissuer.example%2Fpid-offer',
          qrCodeValue: 'openid-credential-offer://?credential_offer=%7B%22credential_issuer%22%3A%22https%3A%2F%2Fissuer.example%22%2C%22credentials%22%3A%5B%22EmployeeIdentityCredential%22%5D%7D',
          referenceUri: 'https://issuer.example/pid-offer',
        }),
      }),
    ]);

    const poaSeedResponse = await request(app)
      .post(`/api/sessions/${created.body.sessionId}/wallets/personal/credentials`)
      .send({ credentialType: 'poa' })
      .expect(200);

    expect(poaSeedResponse.body.wallets.personal.loadedCredentials).toEqual([
      expect.objectContaining({ credentialType: 'pid' }),
      expect.objectContaining({
        credentialType: 'poa',
        offer: expect.objectContaining({
          exchangeId: 'poa-exchange-1',
          offerUri: 'openid-credential-offer://poa-offer',
        }),
      }),
    ]);

    const euccSeedResponse = await request(app)
      .post(`/api/sessions/${created.body.sessionId}/wallets/company/credentials`)
      .send({ credentialType: 'eucc' })
      .expect(200);

    expect(euccSeedResponse.body.wallets.company.loadedCredentials).toEqual([
      expect.objectContaining({
        credentialType: 'eucc',
        offer: expect.objectContaining({
          exchangeId: 'eucc-exchange-1',
          offerUri: 'openid-credential-offer://eucc-offer',
        }),
      }),
    ]);
  });
});