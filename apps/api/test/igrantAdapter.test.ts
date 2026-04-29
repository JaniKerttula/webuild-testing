import { afterEach, describe, expect, it, vi } from 'vitest';

import { createIgrantSandboxAdapter } from '../src/vendors/sandboxAdapter.js';

const originalEnv = { ...process.env };

function createSession() {
  return {
    sessionId: 'session-1',
    vendorId: 'igrant-sandbox',
    lifecycle: 'draft',
    createdAt: '2026-04-21T10:00:00.000Z',
    updatedAt: '2026-04-21T10:00:00.000Z',
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
    pid: { key: 'pid', walletRole: 'personal', status: 'ready' },
    poa: { key: 'poa', walletRole: 'personal', status: 'blocked' },
    eucc: { key: 'eucc', walletRole: 'company', status: 'blocked' },
    review: { key: 'review', walletRole: 'operator', status: 'blocked' },
    vatIssuance: { key: 'vatIssuance', walletRole: 'company', status: 'blocked' },
    eventLog: [],
  } as const;
}

function createReviewedSession() {
  return {
    ...createSession(),
    pid: {
      key: 'pid',
      walletRole: 'personal',
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
          issuedAt: '2026-04-21T10:00:00.000Z',
          expiresAt: '2030-01-01T00:00:00.000Z',
        },
      },
    },
    poa: {
      key: 'poa',
      walletRole: 'personal',
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
    },
    eucc: {
      key: 'eucc',
      walletRole: 'company',
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
    },
    review: {
      key: 'review',
      walletRole: 'operator',
      status: 'succeeded',
      data: {
        person: {
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
        },
        company: {
          companyId: 'FIHPR.2468135-7',
          companyName: 'Teemun Tomaatit Oy',
          legalForm: 'Oy',
          jurisdiction: 'FI',
          registeredOffice: 'Tomaattikuja 7; 33100 Tampere; Finland',
        },
        poa: {
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
        eucc: {
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
    },
  } as const;
}

afterEach(() => {
  process.env = { ...originalEnv };
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('iGrant adapter', () => {
  it('creates wallet seeding OID4VCI offers from repository fixtures', async () => {
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

    const pidSeed = await adapter.seedWalletCredential(createSession(), 'personal', 'pid');
    expect(pidSeed.status).toBe('succeeded');
    expect(pidSeed.data?.credentialType).toBe('pid');
    expect(pidSeed.data?.holderName).toBeTruthy();
    expect(pidSeed.data?.offer?.offerUri).toBe('openid-credential-offer://?credential_offer_uri=https%3A%2F%2Fissuer.example%2Fpid-offer');
    expect(pidSeed.data?.offer?.qrCodeValue).toBe('openid-credential-offer://?credential_offer=%7B%22credential_issuer%22%3A%22https%3A%2F%2Fissuer.example%22%2C%22credentials%22%3A%5B%22EmployeeIdentityCredential%22%5D%7D');
    expect(pidSeed.data?.offer?.referenceUri).toBe('https://issuer.example/pid-offer');

    const [, pidIssueInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    const pidIssueBody = JSON.parse(String(pidIssueInit.body));
    expect(pidIssueBody.credentials[0].id).toBe('pid-entry-id');
    expect(pidIssueBody.credentials[0].claims.givenName).toBeTruthy();

    const poaSeed = await adapter.seedWalletCredential(createSession(), 'personal', 'poa');
    expect(poaSeed.status).toBe('succeeded');
    expect(poaSeed.data?.credentialType).toBe('poa');
    expect(poaSeed.data?.offer?.exchangeId).toBe('poa-exchange-1');

    const [, poaIssueInit] = fetchMock.mock.calls[3] as [string, RequestInit];
    const poaIssueBody = JSON.parse(String(poaIssueInit.body));
    expect(poaIssueBody.credentials[0].id).toBe('poa-entry-id');

    const euccSeed = await adapter.seedWalletCredential(createSession(), 'company', 'eucc');
    expect(euccSeed.status).toBe('succeeded');
    expect(euccSeed.data?.credentialType).toBe('eucc');
    expect(euccSeed.data?.offer?.exchangeId).toBe('eucc-exchange-1');

    const [, euccIssueInit] = fetchMock.mock.calls[5] as [string, RequestInit];
    const euccIssueBody = JSON.parse(String(euccIssueInit.body));
    expect(euccIssueBody.credentials[0].id).toBe('eucc-entry-id');
  });

  it('builds a QR-code-ready offer from the credentialOffer response field', async () => {
    process.env.IGRANT_API_KEY = 'test-key';
    process.env.IGRANT_AUTH_SCHEME = 'Bearer';
    process.env.IGRANT_BASE_URL = 'https://demo-api.igrant.io';
    process.env.IGRANT_PERSONAL_CREDENTIAL_DEFINITION_ID = 'pid-definition';

    const credentialOffer = {
      credential_issuer: 'https://issuer.example',
      credentials: ['EmployeeIdentityCredential'],
      grants: {
        'urn:ietf:params:oauth:grant-type:pre-authorized_code': {
          'pre-authorized_code': 'pre-auth-code-123',
        },
      },
    };

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
          credentialOffer,
        }),
      });

    vi.stubGlobal('fetch', fetchMock);

    const adapter = createIgrantSandboxAdapter();
    const seedResult = await adapter.seedWalletCredential(createSession(), 'personal', 'pid');
    expect(seedResult.status).toBe('succeeded');

    const expectedOfferUri = `openid-credential-offer://?credential_offer=${encodeURIComponent(JSON.stringify(credentialOffer))}`;
    expect(seedResult.data?.offer?.offerUri).toBe(expectedOfferUri);
    expect(seedResult.data?.offer?.qrCodeValue).toBe(expectedOfferUri);
    expect(seedResult.data?.offer?.referenceUri).toBeUndefined();
  });

  it('returns a configuration error when the API key is missing', async () => {
    delete process.env.IGRANT_API_KEY;

    const adapter = createIgrantSandboxAdapter();
    const result = await adapter.requestPid(createSession());

    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('IGRANT_CONFIGURATION_ERROR');
  });

  it('creates the expected PID OIDC4VP verification request in iGrant', async () => {
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
                    { path: ['nationality'], mandatory: true },
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
    const result = await adapter.requestPid(createSession());

    expect(result.status).toBe('pending');
    expect(result.message).toContain('exchange-123');
    expect(result.data?.request?.exchangeId).toBe('exchange-123');
    expect(result.data?.request?.requestUri).toBe('https://verifier.example/request/123');
    expect(result.data?.request?.openId4VpUri).toBe('openid4vp://?request_uri=https%3A%2F%2Fverifier.example%2Frequest%2F123');
    expect(fetchMock).toHaveBeenCalledTimes(4);

    const [listUrl, listInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(listUrl).toBe('https://demo-api.igrant.io/v2/config/digital-wallet/openid/verifier/global-configurations');
    expect((listInit.headers as Record<string, string>).Authorization).toBe('Bearer test-key');

    const [definitionUrl] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(definitionUrl).toBe('https://demo-api.igrant.io/v2/config/digital-wallet/openid/sdjwt/credential-definition/pid-definition');

    const [presentationDefinitionUrl, presentationDefinitionInit] = fetchMock.mock.calls[2] as [string, RequestInit];
    expect(presentationDefinitionUrl).toBe('https://demo-api.igrant.io/v2/config/digital-wallet/openid/sdjwt/presentation-definition');

    const presentationDefinitionBody = JSON.parse(String(presentationDefinitionInit.body));
    expect(presentationDefinitionBody.label).toContain('We Build Testing PID verification session-1');
    expect(presentationDefinitionBody.dcqlQuery.credentials[0]).toMatchObject({
      id: 'pid',
      format: 'dc+sd-jwt',
      meta: {
        vct_values: ['urn:we-build:credential:test-pid:1'],
      },
      require_cryptographic_holder_binding: true,
      multiple: false,
    });
    expect(presentationDefinitionBody.dcqlQuery.credentials[0].claims).toEqual([
      { path: ['givenName'] },
      { path: ['familyName'] },
      { path: ['dateOfBirth'] },
      { path: ['nationality'] },
    ]);

    const [verificationUrl, verificationInit] = fetchMock.mock.calls[3] as [string, RequestInit];
    expect(verificationUrl).toBe('https://demo-api.igrant.io/v3/config/digital-wallet/openid/sdjwt/verification/send');
    expect(JSON.parse(String(verificationInit.body))).toEqual({
      presentationDefinitionId: 'pd-123',
      requestByReference: true,
      urlPrefix: 'openid4vp://',
    });
  });

  it('creates a PID OIDC4VP request when iGrant returns request fields at the top level', async () => {
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
          presentationExchangeId: 'exchange-123',
          vpTokenQrCode: 'openid4vp://?request_uri=https%3A%2F%2Fverifier.example%2Frequest%2F123',
        }),
      });

    vi.stubGlobal('fetch', fetchMock);

    const adapter = createIgrantSandboxAdapter();
    const result = await adapter.requestPid(createSession());

    expect(result.status).toBe('pending');
    expect(result.data?.request?.exchangeId).toBe('exchange-123');
    expect(result.data?.request?.requestUri).toBe('https://verifier.example/request/123');
    expect(result.data?.request?.openId4VpUri).toBe('openid4vp://?request_uri=https%3A%2F%2Fverifier.example%2Frequest%2F123');
  });

  it('creates an EUCC OIDC4VP request using only mandatory credential-definition claims', async () => {
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
                vct: 'urn:we-build:credential:eucc-attestation:1',
                claims: {
                  claims: [
                    { path: ['legal_person_name'], mandatory: true },
                    { path: ['legal_person_id'], mandatory: true },
                    { path: ['registered_address', 'registered_address_full_address'], mandatory: true },
                    { path: ['registered_address', 'registered_address_care_of'], mandatory: false },
                    { path: ['legal_person_duration'], mandatory: false },
                    { path: ['legal_representative'], mandatory: true },
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
            presentationDefinitionId: 'pd-eucc-123',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({
          verificationHistory: {
            presentationExchangeId: 'exchange-eucc-123',
            vpTokenQrCode: 'openid4vp://?request_uri=https%3A%2F%2Fverifier.example%2Frequest%2Feucc-123',
          },
        }),
      });

    vi.stubGlobal('fetch', fetchMock);

    const adapter = createIgrantSandboxAdapter();
    const result = await adapter.requestEucc(createSession());

    expect(result.status).toBe('pending');

    const [presentationDefinitionUrl, presentationDefinitionInit] = fetchMock.mock.calls[2] as [string, RequestInit];
    expect(presentationDefinitionUrl).toBe('https://demo-api.igrant.io/v2/config/digital-wallet/openid/sdjwt/presentation-definition');

    const presentationDefinitionBody = JSON.parse(String(presentationDefinitionInit.body));
    expect(presentationDefinitionBody.dcqlQuery.credentials[0].claims).toEqual([
      { path: ['legal_person_name'] },
      { path: ['legal_person_id'] },
      { path: ['registered_address', 'registered_address_full_address'] },
      { path: ['legal_representative'] },
    ]);
  });

  it('polls verification history and extracts PID data after the wallet presents it', async () => {
    process.env.IGRANT_API_KEY = 'test-key';
    process.env.IGRANT_AUTH_SCHEME = 'Bearer';
    process.env.IGRANT_BASE_URL = 'https://demo-api.igrant.io';

    const sdJwtPayload = Buffer.from(JSON.stringify({ iss: 'issuer-1', _sd: [] })).toString('base64url');
    const disclosure = Buffer.from(JSON.stringify(['salt', 'givenName', 'Teemu'])).toString('base64url');
    const disclosure2 = Buffer.from(JSON.stringify(['salt', 'familyName', 'Tester'])).toString('base64url');
    const disclosure3 = Buffer.from(JSON.stringify(['salt', 'ageOver18', true])).toString('base64url');
    const disclosure4 = Buffer.from(JSON.stringify(['salt', 'dateOfBirth', '1990-01-01'])).toString('base64url');
    const disclosure5 = Buffer.from(JSON.stringify(['salt', 'nationality', 'FI'])).toString('base64url');
    const disclosure6 = Buffer.from(JSON.stringify(['salt', 'residentCountry', 'FI'])).toString('base64url');
    const sdJwt = `header.${sdJwtPayload}.signature~${disclosure}~${disclosure2}~${disclosure3}~${disclosure4}~${disclosure5}~${disclosure6}`;

    const fetchMock = vi.fn().mockResolvedValueOnce({
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
    const pendingSession = {
      ...createSession(),
      pid: {
        key: 'pid',
        walletRole: 'personal',
        status: 'pending',
        data: {
          request: {
            protocol: 'oidc4vp',
            exchangeId: 'exchange-123',
            requestUri: 'https://verifier.example/request/123',
            openId4VpUri: 'openid4vp://?request_uri=https%3A%2F%2Fverifier.example%2Frequest%2F123',
            qrCodeValue: 'openid4vp://?request_uri=https%3A%2F%2Fverifier.example%2Frequest%2F123',
          },
        },
      },
    };

    const result = await adapter.requestPid(pendingSession as ReturnType<typeof createSession>);

    expect(result.status).toBe('succeeded');
    expect(result.data?.record?.fullName).toBe('Teemu Tester');
    expect(result.data?.record?.dateOfBirth).toBe('1990-01-01');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://demo-api.igrant.io/v3/config/digital-wallet/openid/sdjwt/verification/history/exchange-123');
  });

  it('fails PID polling when the verifier received the request but verification was not successful', async () => {
    process.env.IGRANT_API_KEY = 'test-key';
    process.env.IGRANT_AUTH_SCHEME = 'Bearer';
    process.env.IGRANT_BASE_URL = 'https://demo-api.igrant.io';

    const fetchMock = vi.fn().mockResolvedValueOnce({
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
    const pendingSession = {
      ...createSession(),
      pid: {
        key: 'pid',
        walletRole: 'personal',
        status: 'pending',
        data: {
          request: {
            protocol: 'oidc4vp',
            exchangeId: 'exchange-123',
            requestUri: 'https://verifier.example/request/123',
            openId4VpUri: 'openid4vp://?request_uri=https%3A%2F%2Fverifier.example%2Frequest%2F123',
            qrCodeValue: 'openid4vp://?request_uri=https%3A%2F%2Fverifier.example%2Frequest%2F123',
          },
        },
      },
    };

    const result = await adapter.requestPid(pendingSession as ReturnType<typeof createSession>);

    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('IGRANT_PID_VERIFICATION_FAILED');
    expect(result.error?.message).toContain('credential verification failed');
  });

  it('extracts PID data when the verifier marks the presentation verified with a non-acked terminal status', async () => {
    process.env.IGRANT_API_KEY = 'test-key';
    process.env.IGRANT_AUTH_SCHEME = 'Bearer';
    process.env.IGRANT_BASE_URL = 'https://demo-api.igrant.io';

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

    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({
        verificationHistory: {
          presentationExchangeId: 'exchange-123',
          status: 'openid.verifier.response_verified',
          verified: true,
          vpTokenResponse: {
            vp_token: sdJwt,
          },
        },
      }),
    });

    vi.stubGlobal('fetch', fetchMock);

    const adapter = createIgrantSandboxAdapter();
    const pendingSession = {
      ...createSession(),
      pid: {
        key: 'pid',
        walletRole: 'personal',
        status: 'pending',
        data: {
          request: {
            protocol: 'oidc4vp',
            exchangeId: 'exchange-123',
            requestUri: 'https://verifier.example/request/123',
            openId4VpUri: 'openid4vp://?request_uri=https%3A%2F%2Fverifier.example%2Frequest%2F123',
            qrCodeValue: 'openid4vp://?request_uri=https%3A%2F%2Fverifier.example%2Frequest%2F123',
          },
        },
      },
    };

    const result = await adapter.requestPid(pendingSession as ReturnType<typeof createSession>);

    expect(result.status).toBe('succeeded');
    expect(result.data?.record?.fullName).toBe('Teemu Tester');
  });

  it('polls verification history and extracts PoA data after the wallet presents it', async () => {
    process.env.IGRANT_API_KEY = 'test-key';
    process.env.IGRANT_AUTH_SCHEME = 'Bearer';
    process.env.IGRANT_BASE_URL = 'https://demo-api.igrant.io';

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

    const fetchMock = vi.fn().mockResolvedValueOnce({
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
    const pendingSession = {
      ...createSession(),
      poa: {
        key: 'poa',
        walletRole: 'personal',
        status: 'pending',
        data: {
          request: {
            protocol: 'oidc4vp',
            exchangeId: 'exchange-456',
            requestUri: 'https://verifier.example/request/456',
            openId4VpUri: 'openid4vp://?request_uri=https%3A%2F%2Fverifier.example%2Frequest%2F456',
            qrCodeValue: 'openid4vp://?request_uri=https%3A%2F%2Fverifier.example%2Frequest%2F456',
          },
        },
      },
    };

    const result = await adapter.requestPoa(pendingSession as ReturnType<typeof createSession>);

    expect(result.status).toBe('succeeded');
    expect(result.data?.record?.attorneyName).toBe('Teemu Tester');
    expect(result.data?.record?.principalName).toBe('We Build Oy');
    expect(result.data?.record?.companyId).toBe('FI:1234567-8');
    expect(result.data?.record?.scope).toEqual(['vat-filing', 'signing']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://demo-api.igrant.io/v3/config/digital-wallet/openid/sdjwt/verification/history/exchange-456');
  });

  it('fails PoA polling when the verifier received the request but verification was not successful', async () => {
    process.env.IGRANT_API_KEY = 'test-key';
    process.env.IGRANT_AUTH_SCHEME = 'Bearer';
    process.env.IGRANT_BASE_URL = 'https://demo-api.igrant.io';

    const fetchMock = vi.fn().mockResolvedValueOnce({
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
    const pendingSession = {
      ...createSession(),
      poa: {
        key: 'poa',
        walletRole: 'personal',
        status: 'pending',
        data: {
          request: {
            protocol: 'oidc4vp',
            exchangeId: 'exchange-456',
            requestUri: 'https://verifier.example/request/456',
            openId4VpUri: 'openid4vp://?request_uri=https%3A%2F%2Fverifier.example%2Frequest%2F456',
            qrCodeValue: 'openid4vp://?request_uri=https%3A%2F%2Fverifier.example%2Frequest%2F456',
          },
        },
      },
    };

    const result = await adapter.requestPoa(pendingSession as ReturnType<typeof createSession>);

    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('IGRANT_POA_VERIFICATION_FAILED');
    expect(result.error?.message).toContain('credential verification failed');
  });

  it('keeps PoA polling pending when verification history is not present yet in a successful response', async () => {
    process.env.IGRANT_API_KEY = 'test-key';
    process.env.IGRANT_AUTH_SCHEME = 'Bearer';
    process.env.IGRANT_BASE_URL = 'https://demo-api.igrant.io';

    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({}),
    });

    vi.stubGlobal('fetch', fetchMock);

    const adapter = createIgrantSandboxAdapter();
    const pendingSession = {
      ...createSession(),
      poa: {
        key: 'poa',
        walletRole: 'personal',
        status: 'pending',
        data: {
          request: {
            protocol: 'oidc4vp',
            exchangeId: 'exchange-456',
            requestUri: 'https://verifier.example/request/456',
            openId4VpUri: 'openid4vp://?request_uri=https%3A%2F%2Fverifier.example%2Frequest%2F456',
            qrCodeValue: 'openid4vp://?request_uri=https%3A%2F%2Fverifier.example%2Frequest%2F456',
          },
        },
      },
    };

    const result = await adapter.requestPoa(pendingSession as ReturnType<typeof createSession>);

    expect(result.status).toBe('pending');
    expect(result.data?.request?.exchangeId).toBe('exchange-456');
    expect(result.message).toContain('Waiting for PoA verification exchange exchange-456');
  });

  it('extracts PoA data even when optional attorney date of birth is omitted', async () => {
    process.env.IGRANT_API_KEY = 'test-key';
    process.env.IGRANT_AUTH_SCHEME = 'Bearer';
    process.env.IGRANT_BASE_URL = 'https://demo-api.igrant.io';

    const sdJwtPayload = Buffer.from(JSON.stringify({ iss: 'issuer-1', _sd: [] })).toString('base64url');
    const disclosures = [
      ['salt', 'euid_reference', 'FI:1234567-8'],
      ['salt', 'company_statutory_full_name', 'We Build Oy'],
      ['salt', 'principal_full_name', 'We Build Oy'],
      ['salt', 'attorney_full_name', 'Teemu Tester'],
      ['salt', 'validity_period_valid_from', '2026-04-21'],
      ['salt', 'validity_period_valid_until', '2030-01-01'],
      ['salt', 'applicable_law_jurisdiction', 'FI'],
      ['salt', 'signing_place', 'Helsinki'],
      ['salt', 'signing_date', '2026-04-21'],
      ['salt', 'scope_of_representation_powers', ['vat-filing', 'signing']],
    ].map((value) => Buffer.from(JSON.stringify(value)).toString('base64url'));
    const sdJwt = `header.${sdJwtPayload}.signature~${disclosures.join('~')}`;

    const fetchMock = vi.fn().mockResolvedValueOnce({
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
    const pendingSession = {
      ...createSession(),
      poa: {
        key: 'poa',
        walletRole: 'personal',
        status: 'pending',
        data: {
          request: {
            protocol: 'oidc4vp',
            exchangeId: 'exchange-456',
            requestUri: 'https://verifier.example/request/456',
            openId4VpUri: 'openid4vp://?request_uri=https%3A%2F%2Fverifier.example%2Frequest%2F456',
            qrCodeValue: 'openid4vp://?request_uri=https%3A%2F%2Fverifier.example%2Frequest%2F456',
          },
        },
      },
    };

    const result = await adapter.requestPoa(pendingSession as ReturnType<typeof createSession>);

    expect(result.status).toBe('succeeded');
    expect(result.data?.record?.attorneyName).toBe('Teemu Tester');
    expect(result.data?.record?.attorneyDateOfBirth).toBeUndefined();
    expect(result.data?.record?.scope).toEqual(['vat-filing', 'signing']);
  });

  it('polls verification history and extracts EUCC data after the wallet presents it', async () => {
    process.env.IGRANT_API_KEY = 'test-key';
    process.env.IGRANT_AUTH_SCHEME = 'Bearer';
    process.env.IGRANT_BASE_URL = 'https://demo-api.igrant.io';

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

    const fetchMock = vi.fn().mockResolvedValueOnce({
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
    const pendingSession = {
      ...createSession(),
      eucc: {
        key: 'eucc',
        walletRole: 'company',
        status: 'pending',
        data: {
          request: {
            protocol: 'oidc4vp',
            exchangeId: 'exchange-789',
            requestUri: 'https://verifier.example/request/789',
            openId4VpUri: 'openid4vp://?request_uri=https%3A%2F%2Fverifier.example%2Frequest%2F789',
            qrCodeValue: 'openid4vp://?request_uri=https%3A%2F%2Fverifier.example%2Frequest%2F789',
          },
        },
      },
    };

    const result = await adapter.requestEucc(pendingSession as ReturnType<typeof createSession>);

    expect(result.status).toBe('succeeded');
    expect(result.data?.record?.companyId).toBe('FIHPR.2468135-7');
    expect(result.data?.record?.companyName).toBe('Teemun Tomaatit Oy');
    expect(result.data?.record?.representativeNames).toEqual(['Teemu Testi']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://demo-api.igrant.io/v3/config/digital-wallet/openid/sdjwt/verification/history/exchange-789');
  });

  it('keeps EUCC polling pending when verification history returns HTTP 204', async () => {
    process.env.IGRANT_API_KEY = 'test-key';
    process.env.IGRANT_AUTH_SCHEME = 'Bearer';
    process.env.IGRANT_BASE_URL = 'https://demo-api.igrant.io';

    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 204,
      text: async () => '',
    });

    vi.stubGlobal('fetch', fetchMock);

    const adapter = createIgrantSandboxAdapter();
    const pendingSession = {
      ...createSession(),
      eucc: {
        key: 'eucc',
        walletRole: 'company',
        status: 'pending',
        data: {
          request: {
            protocol: 'oidc4vp',
            exchangeId: 'exchange-789',
            requestUri: 'https://verifier.example/request/789',
            openId4VpUri: 'openid4vp://?request_uri=https%3A%2F%2Fverifier.example%2Frequest%2F789',
            qrCodeValue: 'openid4vp://?request_uri=https%3A%2F%2Fverifier.example%2Frequest%2F789',
          },
        },
      },
    };

    const result = await adapter.requestEucc(pendingSession as ReturnType<typeof createSession>);

    expect(result.status).toBe('pending');
    expect(result.data?.request?.exchangeId).toBe('exchange-789');
    expect(result.message).toContain('Waiting for EUCC verification exchange exchange-789');
  });

  it('fails EUCC polling when the verifier received the request but verification was not successful', async () => {
    process.env.IGRANT_API_KEY = 'test-key';
    process.env.IGRANT_AUTH_SCHEME = 'Bearer';
    process.env.IGRANT_BASE_URL = 'https://demo-api.igrant.io';

    const fetchMock = vi.fn().mockResolvedValueOnce({
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
    const pendingSession = {
      ...createSession(),
      eucc: {
        key: 'eucc',
        walletRole: 'company',
        status: 'pending',
        data: {
          request: {
            protocol: 'oidc4vp',
            exchangeId: 'exchange-789',
            requestUri: 'https://verifier.example/request/789',
            openId4VpUri: 'openid4vp://?request_uri=https%3A%2F%2Fverifier.example%2Frequest%2F789',
            qrCodeValue: 'openid4vp://?request_uri=https%3A%2F%2Fverifier.example%2Frequest%2F789',
          },
        },
      },
    };

    const result = await adapter.requestEucc(pendingSession as ReturnType<typeof createSession>);

    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('IGRANT_EUCC_VERIFICATION_FAILED');
    expect(result.error?.message).toContain('credential verification failed');
  });

  it('starts VAT issuance with the Bruno in-time JWT VC payload shape', async () => {
    process.env.IGRANT_API_KEY = 'test-key';
    process.env.IGRANT_VAT_CREDENTIAL_DEFINITION_ID = 'vat-definition';

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({
          credentialDefinition: {
            credentialDefinitions: [
              {
                id: 'vat-entry-id',
              },
            ],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({
          credentialExchangeId: 'vat-exchange-1',
          credentialOfferUri: 'openid-credential-offer://?credential_offer_uri=https://issuer.example/vat-offer',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ credentialHistory: { status: 'offer_sent' } }),
      });

    vi.stubGlobal('fetch', fetchMock);

    const adapter = createIgrantSandboxAdapter();
    const started = await adapter.submitVatIssuance(createReviewedSession());
    expect(started.status).toBe('pending');
    expect(started.data?.walletCredential?.credentialType).toBe('vat');
    expect(started.data?.walletCredential?.status).toBe('offer-created');
    expect(started.data?.walletCredential?.offer?.offerUri).toBe('openid-credential-offer://?credential_offer_uri=https%3A%2F%2Fissuer.example%2Fvat-offer');

    const [, issueInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(JSON.parse(String(issueInit.body))).toMatchObject({
      issuanceMode: 'InTime',
      credentialDefinitionId: 'vat-definition',
      credentials: [
        {
          id: 'vat-entry-id',
          credentialSubject: {
            credentialSubject: {
              VAT_ID: 'FI24681357',
              Economic_Operator: {
                EUID: 'FIHPR.2468135-7',
                Economic_Operator_Name: 'Teemun Tomaatit Oy',
              },
            },
          },
        },
      ],
    });

    const pendingSession = {
      ...createReviewedSession(),
      vatIssuance: {
        key: 'vatIssuance',
        walletRole: 'company',
        status: 'pending',
        data: started.data,
      },
    };

    const pending = await adapter.readIssuanceStatus(pendingSession);
    expect(pending.status).toBe('pending');
    expect(pending.message).toContain('offer_sent');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('keeps VAT issuance pending while history remains non-successful', async () => {
    process.env.IGRANT_API_KEY = 'test-key';
    process.env.IGRANT_VAT_CREDENTIAL_DEFINITION_ID = 'vat-definition';

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({
          credentialDefinition: {
            credentialDefinitions: [
              {
                id: 'vat-entry-id',
              },
            ],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({
          credentialExchangeId: 'vat-exchange-2',
          credentialOfferUri: 'openid-credential-offer://?credential_offer_uri=https://issuer.example/vat-offer-2',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ credentialHistory: { status: 'credential_acked' } }),
      });

    vi.stubGlobal('fetch', fetchMock);

    const adapter = createIgrantSandboxAdapter();
    const started = await adapter.submitVatIssuance(createReviewedSession());

    const result = await adapter.readIssuanceStatus({
      ...createReviewedSession(),
      vatIssuance: {
        key: 'vatIssuance',
        walletRole: 'company',
        status: 'pending',
        data: started.data,
      },
    });

    expect(result.status).toBe('pending');
    expect(result.message).toContain('credential_acked');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('fails VAT issuance when history reaches credential_deleted', async () => {
    process.env.IGRANT_API_KEY = 'test-key';
    process.env.IGRANT_VAT_CREDENTIAL_DEFINITION_ID = 'vat-definition';

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({
          credentialDefinition: {
            credentialDefinitions: [
              {
                id: 'vat-entry-id',
              },
            ],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({
          credentialExchangeId: 'vat-exchange-3',
          credentialOfferUri: 'openid-credential-offer://?credential_offer_uri=https://issuer.example/vat-offer-3',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ credentialHistory: { status: 'credential_deleted' } }),
      });

    vi.stubGlobal('fetch', fetchMock);

    const adapter = createIgrantSandboxAdapter();
    const started = await adapter.submitVatIssuance(createReviewedSession());

    const result = await adapter.readIssuanceStatus({
      ...createReviewedSession(),
      vatIssuance: {
        key: 'vatIssuance',
        walletRole: 'company',
        status: 'pending',
        data: started.data,
      },
    });

    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('IGRANT_ISSUANCE_FAILED');
    expect(result.error?.message).toContain('credential_deleted');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('completes VAT issuance when history reaches credential_accepted', async () => {
    process.env.IGRANT_API_KEY = 'test-key';
    process.env.IGRANT_VAT_CREDENTIAL_DEFINITION_ID = 'vat-definition';

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({
          credentialDefinition: {
            credentialDefinitions: [
              {
                id: 'vat-entry-id',
              },
            ],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({
          credentialExchangeId: 'vat-exchange-4',
          credentialOfferUri: 'openid-credential-offer://?credential_offer_uri=https://issuer.example/vat-offer-4',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ credentialHistory: { status: 'credential_accepted' } }),
      });

    vi.stubGlobal('fetch', fetchMock);

    const adapter = createIgrantSandboxAdapter();
    const started = await adapter.submitVatIssuance(createReviewedSession());

    const result = await adapter.readIssuanceStatus({
      ...createReviewedSession(),
      vatIssuance: {
        key: 'vatIssuance',
        walletRole: 'company',
        status: 'pending',
        data: started.data,
      },
    });

    expect(result.status).toBe('succeeded');
    expect(result.data?.exchangeId).toBe('vat-exchange-4');
    expect(result.data?.walletCredential?.status).toBe('issued');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('starts VAT issuance when iGrant returns the exchange id under credentialHistory.id', async () => {
    process.env.IGRANT_API_KEY = 'test-key';
    process.env.IGRANT_AUTH_SCHEME = 'Bearer';
    process.env.IGRANT_BASE_URL = 'https://demo-api.igrant.io';
    process.env.IGRANT_VAT_CREDENTIAL_DEFINITION_ID = 'vat-definition';

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({
          credentialDefinition: {
            credentialDefinitions: [
              {
                id: 'vat-entry-id',
              },
            ],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({
          credentialHistory: {
            id: 'vat-exchange-history-id',
            credentialOfferUri: 'openid-credential-offer://?credential_offer_uri=https://issuer.example/vat-offer',
          },
        }),
      });

    vi.stubGlobal('fetch', fetchMock);

    const adapter = createIgrantSandboxAdapter();
    const result = await adapter.submitVatIssuance(createReviewedSession());

    expect(result.status).toBe('pending');
    expect(result.data?.exchangeId).toBe('vat-exchange-history-id');
    expect(result.data?.walletCredential?.offer?.exchangeId).toBe('vat-exchange-history-id');
  });

  it('fails review assembly when the EUCC company has no VAT attestation match', async () => {
    const adapter = createIgrantSandboxAdapter();
    const session = {
      ...createReviewedSession(),
      review: {
        key: 'review',
        walletRole: 'operator',
        status: 'ready',
      },
      eucc: {
        key: 'eucc',
        walletRole: 'company',
        status: 'succeeded',
        data: {
          record: {
            companyId: 'FIHPR.9999999-9',
            companyName: 'Unmatched Example Oy',
            legalForm: 'Oy',
            registrationMemberState: 'FI',
            registeredAddress: 'Examplekatu 1; 00100 Helsinki; Finland',
            registrationDate: '2025-01-01',
            legalPersonStatus: 'active',
            activityCodes: ['62.01'],
            representativeNames: ['Ulla Example'],
          },
        },
      },
    };

    const result = await adapter.assembleReview(session as ReturnType<typeof createSession>);

    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('IGRANT_VAT_ATTESTATION_NOT_FOUND');
  });
});