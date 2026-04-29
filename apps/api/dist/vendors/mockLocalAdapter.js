import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { findVatAttestationForEucc, normalizeVatAttestationRecord, } from './vatAttestationRegistry.js';
const definition = {
    id: 'mock-local',
    label: 'Local Mock Vendor',
    description: 'Local mock flow that keeps all steps self-contained on localhost.',
    badge: 'Local demo',
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
let fixturePromise;
function createFailureError(message) {
    return {
        code: 'MOCK_VENDOR_SIMULATED_FAILURE',
        message,
        retryable: true,
        source: 'vendor-adapter',
    };
}
function createFailureResult(message) {
    return {
        status: 'failed',
        error: createFailureError(message),
        message,
    };
}
function resolveMode(options) {
    return options?.simulationMode ?? 'success';
}
async function loadFixture(relativePath) {
    const absolutePath = fileURLToPath(new URL(relativePath, import.meta.url));
    const content = await readFile(absolutePath, 'utf-8');
    return JSON.parse(content);
}
async function loadFixtures() {
    fixturePromise ??= Promise.all([
        loadFixture('../../../../mock-data/pid-credential.mock.json'),
        loadFixture('../../../../mock-data/poa-attestation-credential.mock.json'),
        loadFixture('../../../../mock-data/eucc-attestation-credential.mock.json'),
    ]).then(([pid, poa, eucc]) => ({ pid, poa, eucc }));
    return fixturePromise;
}
function normalizePidRecord(fixture) {
    return {
        givenName: fixture.credentialSubject.givenName,
        familyName: fixture.credentialSubject.familyName,
        fullName: `${fixture.credentialSubject.givenName} ${fixture.credentialSubject.familyName}`,
        dateOfBirth: fixture.credentialSubject.dateOfBirth,
        nationality: fixture.credentialSubject.nationality,
        residentCountry: fixture.credentialSubject.residentCountry,
        ageOver18: fixture.credentialSubject.ageOver18,
        issuerName: fixture.issuer.name,
        issuerId: fixture.issuer.id,
        issuedAt: fixture.issuanceDate,
        expiresAt: fixture.expirationDate,
    };
}
function normalizePoaRecord(fixture) {
    return {
        companyId: fixture.euid_reference,
        companyName: fixture.company_statutory_full_name,
        principalName: fixture.principal_full_name,
        attorneyName: fixture.attorney_full_name,
        attorneyDateOfBirth: fixture.attorney_date_of_birth,
        scope: fixture.scope_of_representation_powers,
        substitutionAllowed: fixture.scope_of_representation_power_of_substitution !== 'not_allowed',
        validFrom: fixture.validity_period_valid_from,
        validUntil: fixture.validity_period_valid_until,
        lawJurisdiction: fixture.applicable_law_jurisdiction,
        signingPlace: fixture.signing_place,
        signingDate: fixture.signing_date,
    };
}
function normalizeEuccRecord(fixture) {
    return {
        companyId: fixture.legal_person_id,
        companyName: fixture.legal_person_name,
        legalForm: fixture.legal_form_type,
        registrationMemberState: fixture.registration_member_state,
        registeredAddress: fixture.registered_address.registered_address_full_address,
        registrationDate: fixture.registration_date,
        legalPersonStatus: fixture.legal_person_status,
        activityCodes: fixture.legal_person_activity,
        contactEmail: fixture.contact_point?.contact_email,
        contactPage: fixture.contact_point?.contact_page,
        representativeNames: fixture.legal_representative.map((representative) => representative.legal_representative_natural_person.legal_representative_natural_person_full_name),
    };
}
function createCompanyContextFromEucc(record) {
    return {
        companyId: record.companyId,
        companyName: record.companyName,
        legalForm: record.legalForm,
        jurisdiction: record.registrationMemberState,
        registeredOffice: record.registeredAddress,
    };
}
function normalizeVatPending(attestation) {
    return {
        vatId: attestation.vatId,
        administrativeUnitName: attestation.administrativeUnitName,
        administrativeUnitType: attestation.administrativeUnitType,
        issuingCountry: attestation.issuingCountry,
        issuingOrganisation: attestation.issuingOrganisation,
        exchangeId: 'mock-exchange-001',
        status: 'pending',
    };
}
function normalizeVatIssued(attestation) {
    return {
        vatId: attestation.vatId,
        administrativeUnitName: attestation.administrativeUnitName,
        administrativeUnitType: attestation.administrativeUnitType,
        issuingCountry: attestation.issuingCountry,
        issuingOrganisation: attestation.issuingOrganisation,
        exchangeId: 'mock-exchange-001',
        issuedAt: attestation.issuedAt,
        status: 'issued',
    };
}
function createIssuedVatWalletCredential(attestation) {
    const seededAt = new Date().toISOString();
    return {
        credentialType: 'vat',
        label: 'Mock VAT attestation',
        holderName: attestation.economicOperatorName,
        issuerName: attestation.issuingOrganisation,
        seededAt,
        status: 'issued',
    };
}
function createWalletCredentialSummary(credentialType, holderName, issuerName, seededAt) {
    const labelByType = {
        pid: 'Mock PID credential',
        poa: 'Mock PoA attestation',
        eucc: 'Mock EUCC attestation',
        vat: 'Mock VAT attestation',
    };
    return {
        credentialType,
        label: labelByType[credentialType],
        holderName,
        issuerName,
        seededAt,
        status: 'seeded',
    };
}
export function createMockLocalAdapter() {
    return {
        definition,
        async seedWalletCredential(_session, walletRole, credentialType) {
            const fixture = await loadFixtures();
            const seededAt = new Date().toISOString();
            if (walletRole === 'personal' && credentialType === 'pid') {
                const pidRecord = normalizePidRecord(fixture.pid);
                return {
                    status: 'succeeded',
                    data: createWalletCredentialSummary('pid', pidRecord.fullName, pidRecord.issuerName, seededAt),
                    message: 'Mock PID issued to the personal wallet.',
                };
            }
            if (walletRole === 'personal' && credentialType === 'poa') {
                const poaRecord = normalizePoaRecord(fixture.poa);
                return {
                    status: 'succeeded',
                    data: createWalletCredentialSummary('poa', poaRecord.attorneyName, 'Finnish Trade Register', seededAt),
                    message: 'Mock PoA issued to the personal wallet.',
                };
            }
            if (walletRole === 'company' && credentialType === 'eucc') {
                const euccRecord = normalizeEuccRecord(fixture.eucc);
                return {
                    status: 'succeeded',
                    data: createWalletCredentialSummary('eucc', euccRecord.companyName, 'Mock Company Wallet', seededAt),
                    message: 'Mock EUCC attestation issued to the company wallet.',
                };
            }
            return createFailureResult(`Credential ${credentialType} cannot be seeded into the ${walletRole} wallet.`);
        },
        async requestPid(_session, options) {
            const mode = resolveMode(options);
            if (mode === 'failure') {
                return createFailureResult('Mock PID retrieval failed for testing purposes.');
            }
            if (mode === 'pending') {
                return {
                    status: 'pending',
                    message: 'Mock PID retrieval is pending.',
                };
            }
            const fixture = await loadFixtures();
            return {
                status: 'succeeded',
                data: {
                    record: normalizePidRecord(fixture.pid),
                },
                message: 'Mock PID retrieved from local fixture data.',
            };
        },
        async requestPoa(_session, options) {
            const mode = resolveMode(options);
            if (mode === 'failure') {
                return createFailureResult('Mock PoA retrieval failed for testing purposes.');
            }
            if (mode === 'pending') {
                return {
                    status: 'pending',
                    message: 'Mock PoA retrieval is pending.',
                };
            }
            const fixture = await loadFixtures();
            return {
                status: 'succeeded',
                data: {
                    record: normalizePoaRecord(fixture.poa),
                },
                message: 'Mock PoA retrieved from local fixture data.',
            };
        },
        async requestEucc(_session, options) {
            const mode = resolveMode(options);
            if (mode === 'failure') {
                return createFailureResult('Mock EUCC retrieval failed for testing purposes.');
            }
            if (mode === 'pending') {
                return {
                    status: 'pending',
                    message: 'Mock EUCC retrieval is pending.',
                };
            }
            const fixture = await loadFixtures();
            return {
                status: 'succeeded',
                data: {
                    record: normalizeEuccRecord(fixture.eucc),
                },
                message: 'Mock EUCC retrieved from local fixture data.',
            };
        },
        async assembleReview(session, options) {
            const mode = resolveMode(options);
            if (mode === 'failure') {
                return createFailureResult('Mock review assembly failed for testing purposes.');
            }
            if (mode === 'pending') {
                return {
                    status: 'pending',
                    message: 'Mock review assembly is pending.',
                };
            }
            if (!session.pid.data?.record || !session.poa.data?.record || !session.eucc.data?.record) {
                return createFailureResult('Review assembly requires PID, PoA, and EUCC data.');
            }
            const matchedVatAttestation = await findVatAttestationForEucc(session.eucc.data.record);
            if (!matchedVatAttestation) {
                return createFailureResult('No VAT attestation mock was found for the company presented in the EUCC.');
            }
            const reviewPayload = {
                person: session.pid.data.record,
                company: session.companyContext ?? createCompanyContextFromEucc(session.eucc.data.record),
                poa: session.poa.data.record,
                eucc: session.eucc.data.record,
                vatAttestation: normalizeVatAttestationRecord(matchedVatAttestation),
                assembledAt: new Date().toISOString(),
            };
            return {
                status: 'succeeded',
                data: reviewPayload,
                message: 'Mock review payload assembled with a matched VAT attestation.',
            };
        },
        async submitVatIssuance(session, options) {
            const mode = resolveMode(options);
            const attestation = session.review.data?.vatAttestation;
            if (!attestation) {
                return createFailureResult('VAT issuance requires a successful review with a matched VAT attestation.');
            }
            if (mode === 'failure') {
                return createFailureResult('Mock VAT issuance submission failed for testing purposes.');
            }
            if (mode === 'success') {
                return {
                    status: 'succeeded',
                    data: {
                        ...normalizeVatIssued(attestation),
                        walletCredential: createIssuedVatWalletCredential(attestation),
                    },
                    message: 'Mock VAT issuance completed immediately.',
                };
            }
            return {
                status: 'pending',
                data: normalizeVatPending(attestation),
                message: 'Mock VAT issuance started and is pending.',
            };
        },
        async readIssuanceStatus(session, options) {
            const mode = resolveMode(options);
            const attestation = session.review.data?.vatAttestation;
            if (!attestation) {
                return createFailureResult('VAT issuance status lookup requires a successful review with a matched VAT attestation.');
            }
            if (mode === 'failure') {
                return createFailureResult('Mock VAT issuance status lookup failed for testing purposes.');
            }
            if (mode === 'pending') {
                return {
                    status: 'pending',
                    data: session.vatIssuance.data ?? normalizeVatPending(attestation),
                    message: 'Mock VAT issuance is still pending.',
                };
            }
            return {
                status: 'succeeded',
                data: {
                    ...normalizeVatIssued(attestation),
                    walletCredential: createIssuedVatWalletCredential(attestation),
                },
                message: 'Mock VAT issuance completed successfully.',
            };
        },
    };
}
