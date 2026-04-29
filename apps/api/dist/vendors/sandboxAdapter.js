import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { findVatAttestationByIdentity, findVatAttestationForEucc, normalizeVatAttestationRecord, } from './vatAttestationRegistry.js';
let fixturePromise;
async function readSharedEnvFile() {
    if (process.env.VITEST) {
        return {};
    }
    try {
        const absolutePath = fileURLToPath(new URL('../../../../.env', import.meta.url));
        const content = await readFile(absolutePath, 'utf-8');
        return content.split(/\r?\n/).reduce((accumulator, line) => {
            const trimmedLine = line.trim();
            if (!trimmedLine || trimmedLine.startsWith('#')) {
                return accumulator;
            }
            const separatorIndex = trimmedLine.indexOf('=');
            if (separatorIndex === -1) {
                return accumulator;
            }
            const key = trimmedLine.slice(0, separatorIndex).trim();
            const value = trimmedLine.slice(separatorIndex + 1).trim();
            accumulator[key] = value;
            return accumulator;
        }, {});
    }
    catch {
        return {};
    }
}
function createNotImplementedError(message) {
    return {
        code: 'VENDOR_OPERATION_NOT_IMPLEMENTED',
        message,
        retryable: false,
        source: 'vendor-adapter',
    };
}
function createFailureResult(message, error) {
    return {
        status: 'failed',
        error: error ?? createNotImplementedError(message),
        message,
    };
}
function createConfigurationError(message) {
    return createFailureResult(message, {
        code: 'IGRANT_CONFIGURATION_ERROR',
        message,
        retryable: false,
        source: 'vendor-adapter',
    });
}
function createHttpError(status, detail) {
    return createFailureResult(`iGrant request failed with ${status}.`, {
        code: 'IGRANT_HTTP_ERROR',
        message: `iGrant request failed with ${status}.`,
        retryable: status >= 500,
        source: 'vendor-adapter',
        detail,
    });
}
function isConfigError(value) {
    return 'error' in value;
}
async function readConfig() {
    const sharedEnv = await readSharedEnvFile();
    const readEnvValue = (key) => process.env[key] ?? sharedEnv[key];
    const config = {
        baseUrl: readEnvValue('IGRANT_BASE_URL') ?? 'https://demo-api.igrant.io',
        authScheme: readEnvValue('IGRANT_AUTH_SCHEME') ?? 'Bearer',
        apiKey: readEnvValue('IGRANT_API_KEY') ?? '',
        personalCredentialDefinitionId: readEnvValue('IGRANT_PERSONAL_CREDENTIAL_DEFINITION_ID') ?? '',
        poaCredentialDefinitionId: readEnvValue('IGRANT_POA_CREDENTIAL_DEFINITION_ID') ?? '',
        euccCredentialDefinitionId: readEnvValue('IGRANT_EUCC_CREDENTIAL_DEFINITION_ID') ?? '',
        vatCredentialDefinitionId: readEnvValue('IGRANT_VAT_CREDENTIAL_DEFINITION_ID') ?? '',
    };
    if (!config.apiKey) {
        return createConfigurationError('IGRANT_API_KEY is missing.');
    }
    return config;
}
function getCredentialExchangeId(payload) {
    return payload.credentialExchangeId
        ?? payload.id
        ?? payload.credentialHistory?.credentialExchangeId
        ?? payload.credentialHistory?.id
        ?? payload.credentialHistory?.CredentialExchangeId
        ?? payload.CredentialExchangeId;
}
function getCredentialOfferValue(payload) {
    return payload.credentialOfferUri
        ?? payload.credential_offer_uri
        ?? payload.credentialOffer
        ?? payload.credential_offer
        ?? payload.credentialHistory?.credentialOfferUri
        ?? payload.credentialHistory?.credential_offer_uri
        ?? payload.credentialHistory?.credentialOffer
        ?? payload.credentialHistory?.credential_offer;
}
function getInlineCredentialOfferValue(payload) {
    return payload.credentialOffer
        ?? payload.credential_offer
        ?? payload.credentialHistory?.credentialOffer
        ?? payload.credentialHistory?.credential_offer;
}
function getCredentialOfferUri(payload) {
    const offerValue = getCredentialOfferValue(payload);
    if (!offerValue) {
        return undefined;
    }
    if (typeof offerValue === 'string') {
        const trimmedValue = offerValue.trim();
        if (!trimmedValue) {
            return undefined;
        }
        if (trimmedValue.startsWith('openid-credential-offer://') || trimmedValue.startsWith('haip://')) {
            try {
                const parsedOfferUri = new URL(trimmedValue);
                if (!parsedOfferUri.search) {
                    return trimmedValue;
                }
                return `${parsedOfferUri.protocol}//?${parsedOfferUri.searchParams.toString()}`;
            }
            catch {
                return trimmedValue;
            }
        }
        if (trimmedValue.startsWith('{')) {
            return `openid-credential-offer://?credential_offer=${encodeURIComponent(trimmedValue)}`;
        }
        return trimmedValue;
    }
    return `openid-credential-offer://?credential_offer=${encodeURIComponent(JSON.stringify(offerValue))}`;
}
function getQrCodeValue(payload, offerUri) {
    const inlineCredentialOfferValue = getInlineCredentialOfferValue(payload);
    if (inlineCredentialOfferValue) {
        const inlineOfferUri = getCredentialOfferUri({
            credentialOffer: inlineCredentialOfferValue,
        });
        if (inlineOfferUri) {
            return inlineOfferUri;
        }
    }
    const referencedOfferUri = getReferencedOfferUri(offerUri);
    if (referencedOfferUri) {
        return referencedOfferUri;
    }
    return offerUri;
}
function getReferencedOfferUri(offerUri) {
    try {
        const parsedOfferUri = new URL(offerUri);
        const referencedOfferUri = parsedOfferUri.searchParams.get('credential_offer_uri');
        if (referencedOfferUri?.startsWith('https://')) {
            return referencedOfferUri;
        }
    }
    catch {
        return undefined;
    }
    return undefined;
}
function getCredentialUserPin(payload, config) {
    return payload.userPin
        ?? payload.user_pin
        ?? payload.txCode
        ?? payload.tx_code
        ?? payload.credentialHistory?.userPin
        ?? payload.credentialHistory?.user_pin
        ?? payload.credentialHistory?.txCode
        ?? payload.credentialHistory?.tx_code;
}
function extractStatus(payload) {
    return String(payload.status
        ?? payload.issuanceStatus
        ?? payload.credentialStatus
        ?? payload.credentialHistory?.status
        ?? payload.credentialHistory?.issuanceStatus
        ?? payload.credentialHistory?.credentialStatus
        ?? 'pending').toLowerCase();
}
const vatIssuanceHistoryStatus = {
    offerSent: 'offer_sent',
    offerReceived: 'offer_received',
    credentialIssued: 'credential_issued',
    credentialAcked: 'credential_acked',
    credentialAccepted: 'credential_accepted',
    credentialDeleted: 'credential_deleted',
    issuanceDenied: 'issuance_denied',
};
function normalizeVatIssuanceHistoryStatus(status) {
    if (status.includes(vatIssuanceHistoryStatus.offerSent)) {
        return vatIssuanceHistoryStatus.offerSent;
    }
    if (status.includes(vatIssuanceHistoryStatus.offerReceived)) {
        return vatIssuanceHistoryStatus.offerReceived;
    }
    if (status.includes(vatIssuanceHistoryStatus.credentialIssued)) {
        return vatIssuanceHistoryStatus.credentialIssued;
    }
    if (status.includes(vatIssuanceHistoryStatus.credentialAcked)) {
        return vatIssuanceHistoryStatus.credentialAcked;
    }
    if (status.includes(vatIssuanceHistoryStatus.credentialAccepted)) {
        return vatIssuanceHistoryStatus.credentialAccepted;
    }
    if (status.includes(vatIssuanceHistoryStatus.credentialDeleted)) {
        return vatIssuanceHistoryStatus.credentialDeleted;
    }
    if (status.includes(vatIssuanceHistoryStatus.issuanceDenied)) {
        return vatIssuanceHistoryStatus.issuanceDenied;
    }
    return vatIssuanceHistoryStatus.offerSent;
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
function normalizePoaRecordFromClaims(claims) {
    const companyId = getStringClaim(claims, 'euid_reference');
    const companyName = getStringClaim(claims, 'company_statutory_full_name');
    const principalName = getStringClaim(claims, 'principal_full_name');
    const attorneyName = getStringClaim(claims, 'attorney_full_name');
    const attorneyDateOfBirth = getStringClaim(claims, 'attorney_date_of_birth');
    const validFrom = getStringClaim(claims, 'validity_period_valid_from');
    const validUntil = getStringClaim(claims, 'validity_period_valid_until');
    const lawJurisdiction = getStringClaim(claims, 'applicable_law_jurisdiction');
    const signingPlace = getStringClaim(claims, 'signing_place');
    const signingDate = getStringClaim(claims, 'signing_date');
    const substitutionValue = getStringClaim(claims, 'scope_of_representation_power_of_substitution');
    const scopeValue = claims.scope_of_representation_powers;
    if (!companyId
        || !companyName
        || !principalName
        || !attorneyName
        || !validFrom
        || !validUntil
        || !lawJurisdiction
        || !signingPlace
        || !signingDate
        || !Array.isArray(scopeValue)
        || !scopeValue.every((item) => typeof item === 'string')) {
        return undefined;
    }
    return {
        companyId,
        companyName,
        principalName,
        attorneyName,
        attorneyDateOfBirth,
        scope: scopeValue,
        substitutionAllowed: substitutionValue !== 'not_allowed',
        validFrom,
        validUntil,
        lawJurisdiction,
        signingPlace,
        signingDate,
    };
}
function normalizeEuccRecordFromClaims(claims) {
    const companyId = getStringClaim(claims, 'legal_person_id');
    const companyName = getStringClaim(claims, 'legal_person_name');
    const legalForm = getStringClaim(claims, 'legal_form_type');
    const registrationMemberState = getStringClaim(claims, 'registration_member_state');
    const registrationDate = getStringClaim(claims, 'registration_date');
    const legalPersonStatus = getStringClaim(claims, 'legal_person_status');
    const registeredAddressValue = claims.registered_address;
    const activityCodesValue = claims.legal_person_activity;
    const contactPointValue = claims.contact_point;
    const representativeValue = claims.legal_representative;
    if (!companyId
        || !companyName
        || !legalForm
        || !registrationMemberState
        || !registrationDate
        || !legalPersonStatus
        || !isRecord(registeredAddressValue)
        || !Array.isArray(activityCodesValue)
        || !activityCodesValue.every((item) => typeof item === 'string')
        || !Array.isArray(representativeValue)) {
        return undefined;
    }
    const registeredAddress = getStringClaim(registeredAddressValue, 'registered_address_full_address');
    if (!registeredAddress) {
        return undefined;
    }
    const representativeNames = representativeValue
        .map((representative) => {
        if (!isRecord(representative)) {
            return undefined;
        }
        const naturalPerson = representative.legal_representative_natural_person;
        if (!isRecord(naturalPerson)) {
            return undefined;
        }
        return getStringClaim(naturalPerson, 'legal_representative_natural_person_full_name');
    })
        .filter((name) => typeof name === 'string' && name.length > 0);
    if (!representativeNames.length) {
        return undefined;
    }
    const contactEmail = isRecord(contactPointValue)
        ? getStringClaim(contactPointValue, 'contact_email')
        : undefined;
    const contactPage = isRecord(contactPointValue)
        ? getStringClaim(contactPointValue, 'contact_page')
        : undefined;
    return {
        companyId,
        companyName,
        legalForm,
        registrationMemberState,
        registeredAddress,
        registrationDate,
        legalPersonStatus,
        activityCodes: activityCodesValue,
        contactEmail,
        contactPage,
        representativeNames,
    };
}
function createPresentationRequest(requestUri, openId4VpUri, exchangeId, presentationDefinitionId) {
    return {
        protocol: 'oidc4vp',
        requestUri,
        openId4VpUri,
        qrCodeValue: openId4VpUri,
        exchangeId,
        presentationDefinitionId,
    };
}
function parseBase64UrlJson(value) {
    try {
        const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
        const normalized = `${base64}${'='.repeat((4 - (base64.length % 4)) % 4)}`;
        const decoded = Buffer.from(normalized, 'base64').toString('utf-8');
        return JSON.parse(decoded);
    }
    catch {
        return undefined;
    }
}
function parseJwtPayload(token) {
    const segments = token.split('.');
    if (segments.length < 2) {
        return undefined;
    }
    const payload = parseBase64UrlJson(segments[1]);
    return typeof payload === 'object' && payload !== null ? payload : undefined;
}
function parseSdJwtClaims(sdJwt) {
    const [issuerJwt, ...segments] = sdJwt.split('~');
    const claims = parseJwtPayload(issuerJwt);
    if (!claims) {
        return undefined;
    }
    for (const disclosure of segments) {
        if (!disclosure || disclosure.includes('.')) {
            continue;
        }
        const parsedDisclosure = parseBase64UrlJson(disclosure);
        if (!Array.isArray(parsedDisclosure) || parsedDisclosure.length < 3) {
            continue;
        }
        const [, claimName, claimValue] = parsedDisclosure;
        if (typeof claimName === 'string') {
            claims[claimName] = claimValue;
        }
    }
    return claims;
}
function isRecord(value) {
    return typeof value === 'object' && value !== null;
}
function getStringClaim(claims, key) {
    const value = claims[key];
    return typeof value === 'string' ? value : undefined;
}
function getBooleanClaim(claims, key) {
    const value = claims[key];
    if (typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'string') {
        if (value === 'true') {
            return true;
        }
        if (value === 'false') {
            return false;
        }
    }
    return undefined;
}
function toPidRecordFromClaims(claims, fixture) {
    const givenName = getStringClaim(claims, 'givenName');
    const familyName = getStringClaim(claims, 'familyName');
    const dateOfBirth = getStringClaim(claims, 'dateOfBirth');
    const nationality = getStringClaim(claims, 'nationality');
    const residentCountry = getStringClaim(claims, 'residentCountry');
    const ageOver18 = getBooleanClaim(claims, 'ageOver18');
    if (!givenName || !familyName || !dateOfBirth || !nationality || !residentCountry || ageOver18 === undefined) {
        return undefined;
    }
    return {
        givenName,
        familyName,
        fullName: `${givenName} ${familyName}`,
        dateOfBirth,
        nationality,
        residentCountry,
        ageOver18,
        issuerName: fixture.issuer.name,
        issuerId: fixture.issuer.id,
        issuedAt: fixture.issuanceDate,
        expiresAt: fixture.expirationDate,
    };
}
function extractPidRecordFromUnknown(value, fixture) {
    if (typeof value === 'string') {
        const parsedClaims = parseSdJwtClaims(value);
        return parsedClaims ? toPidRecordFromClaims(parsedClaims, fixture) : undefined;
    }
    if (Array.isArray(value)) {
        for (const item of value) {
            const parsedRecord = extractPidRecordFromUnknown(item, fixture);
            if (parsedRecord) {
                return parsedRecord;
            }
        }
        return undefined;
    }
    if (!isRecord(value)) {
        return undefined;
    }
    const directRecord = toPidRecordFromClaims(value, fixture);
    if (directRecord) {
        return directRecord;
    }
    const candidateKeys = ['vp_token', 'vpToken', 'verifiableCredential', 'credential', 'presentation', 'vp', 'payload'];
    for (const key of candidateKeys) {
        if (key in value) {
            const parsedRecord = extractPidRecordFromUnknown(value[key], fixture);
            if (parsedRecord) {
                return parsedRecord;
            }
        }
    }
    return undefined;
}
function extractPidRecordFromVerificationHistory(history, fixture) {
    const candidates = [];
    if (history.vpTokenResponse !== undefined) {
        candidates.push(history.vpTokenResponse);
    }
    if (history.presentation?.length) {
        candidates.push(history.presentation);
    }
    for (const candidate of candidates) {
        const pidRecord = extractPidRecordFromUnknown(candidate, fixture);
        if (pidRecord) {
            return pidRecord;
        }
    }
    return undefined;
}
function extractRecordFromUnknown(value, directExtractor) {
    if (typeof value === 'string') {
        const parsedClaims = parseSdJwtClaims(value);
        return parsedClaims ? directExtractor(parsedClaims) : undefined;
    }
    if (Array.isArray(value)) {
        for (const item of value) {
            const parsedRecord = extractRecordFromUnknown(item, directExtractor);
            if (parsedRecord) {
                return parsedRecord;
            }
        }
        return undefined;
    }
    if (!isRecord(value)) {
        return undefined;
    }
    const directRecord = directExtractor(value);
    if (directRecord) {
        return directRecord;
    }
    const candidateKeys = ['vp_token', 'vpToken', 'verifiableCredential', 'credential', 'presentation', 'vp', 'payload'];
    for (const key of candidateKeys) {
        if (key in value) {
            const parsedRecord = extractRecordFromUnknown(value[key], directExtractor);
            if (parsedRecord) {
                return parsedRecord;
            }
        }
    }
    return undefined;
}
function extractPoaRecordFromVerificationHistory(history) {
    const candidates = [];
    if (history.vpTokenResponse !== undefined) {
        candidates.push(history.vpTokenResponse);
    }
    if (history.presentation?.length) {
        candidates.push(history.presentation);
    }
    for (const candidate of candidates) {
        const poaRecord = extractRecordFromUnknown(candidate, normalizePoaRecordFromClaims);
        if (poaRecord) {
            return poaRecord;
        }
    }
    return undefined;
}
function extractEuccRecordFromVerificationHistory(history) {
    const candidates = [];
    if (history.vpTokenResponse !== undefined) {
        candidates.push(history.vpTokenResponse);
    }
    if (history.presentation?.length) {
        candidates.push(history.presentation);
    }
    for (const candidate of candidates) {
        const euccRecord = extractRecordFromUnknown(candidate, normalizeEuccRecordFromClaims);
        if (euccRecord) {
            return euccRecord;
        }
    }
    return undefined;
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
function normalizeVatPending(attestation, exchangeId) {
    return {
        vatId: attestation.vatId,
        administrativeUnitName: attestation.administrativeUnitName,
        administrativeUnitType: attestation.administrativeUnitType,
        issuingCountry: attestation.issuingCountry,
        issuingOrganisation: attestation.issuingOrganisation,
        exchangeId,
        status: 'pending',
    };
}
function normalizeVatIssued(attestation, exchangeId) {
    return {
        vatId: attestation.vatId,
        administrativeUnitName: attestation.administrativeUnitName,
        administrativeUnitType: attestation.administrativeUnitType,
        issuingCountry: attestation.issuingCountry,
        issuingOrganisation: attestation.issuingOrganisation,
        exchangeId,
        issuedAt: attestation.issuedAt,
        status: 'issued',
    };
}
function createVatWalletOfferSummary(attestation, offerUri, qrCodeValue, exchangeId, userPin) {
    return {
        credentialType: 'vat',
        label: 'iGrant VAT attestation',
        holderName: attestation.economicOperatorName,
        issuerName: attestation.issuingOrganisation,
        seededAt: new Date().toISOString(),
        status: 'offer-created',
        offer: {
            protocol: 'oid4vci',
            offerUri,
            qrCodeValue,
            referenceUri: getReferencedOfferUri(offerUri),
            exchangeId,
            userPin,
        },
    };
}
function createIssuedVatWalletCredential(attestation) {
    return {
        credentialType: 'vat',
        label: 'iGrant VAT attestation',
        holderName: attestation.economicOperatorName,
        issuerName: attestation.issuingOrganisation,
        seededAt: new Date().toISOString(),
        status: 'issued',
    };
}
function buildVatCredentialClaims(attestation, administrativeUnitAddress, validityPeriod, economicActivityType, validityAreaLimitation, attestationIssuerName) {
    return {
        VAT_ID: attestation.vatId,
        Administrative_Unit_Name: attestation.administrativeUnitName,
        Administrative_Unit_Type: attestation.administrativeUnitType,
        Administrative_Unit_Address: administrativeUnitAddress,
        Validity_Area_Limitation: validityAreaLimitation ?? [],
        Validity_Period: validityPeriod ?? [],
        Economic_Activity_Type: economicActivityType ?? [],
        Economic_Operator: {
            EUID: attestation.economicOperatorId,
            Economic_Operator_Name: attestation.economicOperatorName,
        },
        Issuer: {
            Issuing_country: attestation.issuingCountry,
            Issuing_Organisation: attestation.issuingOrganisation,
            Issuing_date: attestation.issuedAt,
            Attestation_issuing_Organisation: attestationIssuerName ?? attestation.attestationIssuingOrganisation,
        },
    };
}
function buildVatJwtVcClaims(attestation, administrativeUnitAddress, validityPeriod, economicActivityType, validityAreaLimitation, attestationIssuerName) {
    return {
        credentialSubject: buildVatCredentialClaims(attestation, administrativeUnitAddress, validityPeriod, economicActivityType, validityAreaLimitation, attestationIssuerName),
    };
}
function buildVatJwtVcCredentialSubject(attestation, administrativeUnitAddress, validityPeriod, economicActivityType, validityAreaLimitation, attestationIssuerName) {
    return buildVatJwtVcClaims(attestation, administrativeUnitAddress, validityPeriod, economicActivityType, validityAreaLimitation, attestationIssuerName);
}
function createWalletCredentialSummary(credentialType, holderName, issuerName, seededAt, offerUri, qrCodeValue, exchangeId, userPin) {
    const labelByType = {
        pid: 'iGrant PID credential',
        poa: 'iGrant PoA attestation',
        eucc: 'iGrant EUCC attestation',
        vat: 'iGrant VAT attestation',
    };
    return {
        credentialType,
        label: labelByType[credentialType],
        holderName,
        issuerName,
        seededAt,
        status: 'offer-created',
        offer: {
            protocol: 'oid4vci',
            offerUri,
            qrCodeValue,
            referenceUri: getReferencedOfferUri(offerUri),
            exchangeId,
            userPin,
        },
    };
}
async function issueSeedCredential(config, credentialType, credentialDefinitionId, credentialId, claims, holderName, issuerName) {
    const response = await requestIgrant(config, '/v2/config/digital-wallet/openid/sdjwt/credential/issue', {
        method: 'POST',
        body: JSON.stringify({
            issuanceMode: 'InTime',
            urlScheme: 'openid-credential-offer://',
            credentialDefinitionId,
            credentials: [
                {
                    id: credentialId,
                    claims,
                },
            ],
            userPin: '',
        }),
    });
    if ('error' in response) {
        return response;
    }
    const offerUri = getCredentialOfferUri(response);
    if (!offerUri) {
        return createConfigurationError('iGrant issue response did not include credential offer details.');
    }
    const qrCodeValue = getQrCodeValue(response, offerUri);
    const seededAt = new Date().toISOString();
    return {
        status: 'succeeded',
        data: createWalletCredentialSummary(credentialType, holderName, issuerName, seededAt, offerUri, qrCodeValue, getCredentialExchangeId(response), getCredentialUserPin(response, config)),
        message: `Created iGrant ${credentialType.toUpperCase()} OID4VCI offer for wallet pickup.`,
    };
}
async function resolveAndIssueSeedCredential(config, credentialType, credentialDefinitionId, claims, holderName, issuerName) {
    const credentialEntryId = await resolveCredentialEntryId(config, credentialDefinitionId);
    if (typeof credentialEntryId !== 'string') {
        return credentialEntryId;
    }
    return issueSeedCredential(config, credentialType, credentialDefinitionId, credentialEntryId, claims, holderName, issuerName);
}
function parseJson(text) {
    if (!text) {
        return undefined;
    }
    try {
        return JSON.parse(text);
    }
    catch {
        return undefined;
    }
}
async function requestIgrant(config, path, init) {
    const response = await fetch(`${config.baseUrl}${path}`, {
        ...init,
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `${config.authScheme} ${config.apiKey}`,
            ...(init.headers ?? {}),
        },
    });
    const text = await response.text();
    const payload = parseJson(text);
    if (!response.ok) {
        return createHttpError(response.status, text);
    }
    return (payload ?? {});
}
async function requestVerificationHistory(config, exchangeId) {
    const response = await fetch(`${config.baseUrl}/v3/config/digital-wallet/openid/sdjwt/verification/history/${exchangeId}`, {
        method: 'GET',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `${config.authScheme} ${config.apiKey}`,
        },
    });
    const text = await response.text();
    if (!response.ok) {
        return {
            status: 'error',
            error: createHttpError(response.status, text),
        };
    }
    if (response.status === 204 || !text.trim()) {
        return {
            status: 'empty',
        };
    }
    const payload = parseJson(text);
    return {
        status: 'ok',
        history: payload?.verificationHistory,
    };
}
function isAdapterFailure(value) {
    return typeof value === 'object' && value !== null && 'status' in value && 'message' in value;
}
function getCredentialDefinitionEntry(response) {
    return response.credentialDefinition?.credentialDefinitions?.[0];
}
async function readCredentialDefinition(config, credentialDefinitionId) {
    return requestIgrant(config, `/v2/config/digital-wallet/openid/sdjwt/credential-definition/${credentialDefinitionId}`, { method: 'GET' });
}
async function resolveCredentialEntryId(config, credentialDefinitionId) {
    const response = await readCredentialDefinition(config, credentialDefinitionId);
    if (isAdapterFailure(response)) {
        return response;
    }
    const credentialEntry = getCredentialDefinitionEntry(response);
    const credentialEntryId = credentialEntry?.id ?? credentialEntry?.credentialConfigurationId;
    if (!credentialEntryId) {
        return createConfigurationError(`Credential definition ${credentialDefinitionId} does not expose a credential entry id.`);
    }
    return credentialEntryId;
}
async function ensureVerifierGlobalConfiguration(config) {
    const response = await requestIgrant(config, '/v2/config/digital-wallet/openid/verifier/global-configurations', { method: 'GET' });
    if (isAdapterFailure(response)) {
        return response;
    }
    const items = response.verifierGlobalConfigurations ?? response.verifierGlobalConfiguration;
    const configurations = Array.isArray(items) ? items : items ? [items] : [];
    if (configurations.length > 0) {
        return undefined;
    }
    const createResponse = await requestIgrant(config, '/v2/config/digital-wallet/openid/verifier/global-configuration', {
        method: 'POST',
        body: JSON.stringify({
            supportCredentialEncryption: false,
        }),
    });
    if (isAdapterFailure(createResponse)) {
        if (createResponse.error?.detail?.includes('exists')) {
            return undefined;
        }
        return createResponse;
    }
    return undefined;
}
function buildPresentationDefinitionBody(credentialDefinition, requestLabel, credentialRequestId) {
    const credentialEntry = getCredentialDefinitionEntry(credentialDefinition);
    const vct = credentialEntry?.vct;
    const claims = credentialEntry?.claims?.claims
        ?.filter((claim) => claim.mandatory === true)
        .map((claim) => claim.path)
        .filter((path) => Array.isArray(path) && path.length > 0);
    if (!vct) {
        return createConfigurationError('Credential definition does not expose a VCT for OIDC4VP verification.');
    }
    if (!claims?.length) {
        return createConfigurationError('Credential definition does not expose mandatory claims for OIDC4VP verification.');
    }
    return {
        label: requestLabel,
        version: 'version_01',
        responseType: 'vp_token',
        responseMode: 'direct_post',
        clientIdScheme: 'redirect_uri',
        dcqlQuery: {
            credentials: [
                {
                    id: credentialRequestId,
                    format: 'dc+sd-jwt',
                    meta: {
                        vct_values: [vct],
                    },
                    claims: claims.map((path) => ({ path })),
                    require_cryptographic_holder_binding: true,
                    multiple: false,
                },
            ],
        },
    };
}
function getPresentationDefinitionId(payload) {
    return payload.presentationDefinition?.presentationDefinitionId ?? payload.presentationDefinition?.id;
}
function getVerificationHistory(payload) {
    if (payload.verificationHistory) {
        return payload.verificationHistory;
    }
    if (payload.id
        || payload.presentationExchangeId
        || payload.requestUri
        || payload.verificationRequestUri
        || payload.openid4vpUri
        || payload.vpTokenQrCode
        || payload.verificationRequest) {
        return {
            id: payload.id,
            presentationExchangeId: payload.presentationExchangeId,
            requestUri: payload.requestUri,
            verificationRequestUri: payload.verificationRequestUri,
            openid4vpUri: payload.openid4vpUri,
            vpTokenQrCode: payload.vpTokenQrCode,
            verificationRequest: payload.verificationRequest,
        };
    }
    return undefined;
}
function getVerificationRequestUri(payload) {
    const history = getVerificationHistory(payload);
    const requestUri = history?.requestUri ?? history?.verificationRequestUri;
    if (requestUri?.trim()) {
        return requestUri.trim();
    }
    const requestValue = history?.vpTokenQrCode ?? history?.openid4vpUri ?? history?.verificationRequest;
    if (requestValue?.startsWith('https://')) {
        return requestValue;
    }
    if (requestValue?.startsWith('openid4vp://')) {
        try {
            const parsed = new URL(requestValue);
            const byReferenceUri = parsed.searchParams.get('request_uri');
            if (byReferenceUri?.startsWith('https://')) {
                return byReferenceUri;
            }
        }
        catch {
            return undefined;
        }
    }
    return undefined;
}
function getOpenId4VpUri(payload, requestUri) {
    const history = getVerificationHistory(payload);
    const openId4VpUri = history?.vpTokenQrCode ?? history?.openid4vpUri;
    if (openId4VpUri?.startsWith('openid4vp://')) {
        return openId4VpUri;
    }
    if (!requestUri) {
        return undefined;
    }
    return `openid4vp://?request_uri=${encodeURIComponent(requestUri)}`;
}
function getPresentationExchangeId(payload) {
    const history = getVerificationHistory(payload);
    return history?.presentationExchangeId ?? history?.id;
}
function isVerificationReadyForExtraction(history) {
    if (history.verified === true) {
        return true;
    }
    const normalizedStatus = (history.status ?? '').toLowerCase();
    return normalizedStatus.includes('presentation_acked')
        || normalizedStatus.includes('accepted')
        || normalizedStatus.includes('acknowledged')
        || normalizedStatus.includes('completed')
        || normalizedStatus.includes('verified');
}
const definition = {
    id: 'igrant-sandbox',
    label: 'iGrant Sandbox Shape',
    description: 'External wallet flow backed by the iGrant Product API.',
    badge: 'iGrant',
    walletInteraction: {
        personal: 'external-wallet-app',
        company: 'external-wallet-app',
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
export function createIgrantSandboxAdapter() {
    return {
        definition,
        async seedWalletCredential(_session, walletRole, credentialType) {
            const config = await readConfig();
            if (isConfigError(config)) {
                return config;
            }
            const fixtures = await loadFixtures();
            if (walletRole === 'personal' && credentialType === 'pid') {
                const pidRecord = normalizePidRecord(fixtures.pid);
                if (!config.personalCredentialDefinitionId) {
                    return createConfigurationError('IGRANT_PERSONAL_CREDENTIAL_DEFINITION_ID is missing.');
                }
                return resolveAndIssueSeedCredential(config, 'pid', config.personalCredentialDefinitionId, {
                    givenName: fixtures.pid.credentialSubject.givenName,
                    familyName: fixtures.pid.credentialSubject.familyName,
                    ageOver18: fixtures.pid.credentialSubject.ageOver18,
                    dateOfBirth: fixtures.pid.credentialSubject.dateOfBirth,
                    countryOfBirth: fixtures.pid.credentialSubject.countryOfBirth,
                    nationality: fixtures.pid.credentialSubject.nationality,
                    residentCountry: fixtures.pid.credentialSubject.residentCountry,
                    gender: fixtures.pid.credentialSubject.gender,
                }, pidRecord.fullName, pidRecord.issuerName);
            }
            if (walletRole === 'personal' && credentialType === 'poa') {
                const poaRecord = normalizePoaRecord(fixtures.poa);
                if (!config.poaCredentialDefinitionId) {
                    return createConfigurationError('IGRANT_POA_CREDENTIAL_DEFINITION_ID is missing.');
                }
                return resolveAndIssueSeedCredential(config, 'poa', config.poaCredentialDefinitionId, fixtures.poa, poaRecord.attorneyName, 'iGrant test issuer');
            }
            if (walletRole === 'company' && credentialType === 'eucc') {
                const euccRecord = normalizeEuccRecord(fixtures.eucc);
                if (!config.euccCredentialDefinitionId) {
                    return createConfigurationError('IGRANT_EUCC_CREDENTIAL_DEFINITION_ID is missing.');
                }
                return resolveAndIssueSeedCredential(config, 'eucc', config.euccCredentialDefinitionId, fixtures.eucc, euccRecord.companyName, 'iGrant test issuer');
            }
            return createFailureResult(`Credential ${credentialType} cannot be issued for the ${walletRole} wallet.`);
        },
        async requestPid(_session, options) {
            if (options?.simulationMode === 'failure') {
                return createFailureResult('Simulated iGrant PID verification failure.');
            }
            const config = await readConfig();
            if (isConfigError(config)) {
                return config;
            }
            const existingPidRequest = _session.pid.data?.request;
            if (_session.pid.status === 'pending' && existingPidRequest?.exchangeId) {
                const fixtures = await loadFixtures();
                const response = await requestVerificationHistory(config, existingPidRequest.exchangeId);
                if (response.status === 'error') {
                    return response.error;
                }
                if (response.status === 'empty') {
                    return {
                        status: 'pending',
                        data: {
                            request: existingPidRequest,
                        },
                        message: `Waiting for PID verification exchange ${existingPidRequest.exchangeId}.`,
                    };
                }
                const verificationHistory = response.history;
                if (!verificationHistory) {
                    return {
                        status: 'pending',
                        data: {
                            request: existingPidRequest,
                        },
                        message: `Waiting for PID verification exchange ${existingPidRequest.exchangeId}.`,
                    };
                }
                if (!isVerificationReadyForExtraction(verificationHistory)) {
                    return {
                        status: 'pending',
                        data: {
                            request: existingPidRequest,
                        },
                        message: `Waiting for PID verification exchange ${existingPidRequest.exchangeId}.`,
                    };
                }
                if (verificationHistory.verified !== true) {
                    return createFailureResult('PID collection was received by the verifier, but credential verification failed.', {
                        code: 'IGRANT_PID_VERIFICATION_FAILED',
                        message: 'PID collection was received by the verifier, but credential verification failed.',
                        retryable: false,
                        source: 'vendor-adapter',
                        detail: `Verification exchange ${existingPidRequest.exchangeId} returned status ${String(verificationHistory.status)} with verified=${String(verificationHistory.verified)}.`,
                    });
                }
                const pidRecord = extractPidRecordFromVerificationHistory(verificationHistory, fixtures.pid);
                if (!pidRecord) {
                    return createFailureResult('iGrant verification completed, but the PID credential data could not be extracted.', {
                        code: 'IGRANT_PID_EXTRACTION_FAILED',
                        message: 'iGrant verification completed, but the PID credential data could not be extracted.',
                        retryable: false,
                        source: 'vendor-adapter',
                    });
                }
                return {
                    status: 'succeeded',
                    data: {
                        record: pidRecord,
                    },
                    message: `Received PID credential data from verification exchange ${existingPidRequest.exchangeId}.`,
                };
            }
            const credentialDefinitionId = config.personalCredentialDefinitionId;
            if (!credentialDefinitionId) {
                return createConfigurationError('IGRANT_PERSONAL_CREDENTIAL_DEFINITION_ID is missing.');
            }
            const verifierGlobalConfigurationResult = await ensureVerifierGlobalConfiguration(config);
            if (verifierGlobalConfigurationResult) {
                return verifierGlobalConfigurationResult;
            }
            const credentialDefinitionResponse = await readCredentialDefinition(config, credentialDefinitionId);
            if (isAdapterFailure(credentialDefinitionResponse)) {
                return credentialDefinitionResponse;
            }
            const presentationDefinitionBody = buildPresentationDefinitionBody(credentialDefinitionResponse, `We Build Testing PID verification ${_session.sessionId} ${Date.now()}`, 'pid');
            if ('status' in presentationDefinitionBody) {
                return presentationDefinitionBody;
            }
            const presentationDefinitionResponse = await requestIgrant(config, '/v2/config/digital-wallet/openid/sdjwt/presentation-definition', {
                method: 'POST',
                body: JSON.stringify(presentationDefinitionBody),
            });
            if (isAdapterFailure(presentationDefinitionResponse)) {
                return presentationDefinitionResponse;
            }
            const presentationDefinitionId = getPresentationDefinitionId(presentationDefinitionResponse);
            if (!presentationDefinitionId) {
                return createConfigurationError('iGrant presentation definition response did not include a presentationDefinitionId.');
            }
            const response = await requestIgrant(config, '/v3/config/digital-wallet/openid/sdjwt/verification/send', {
                method: 'POST',
                body: JSON.stringify({
                    presentationDefinitionId,
                    requestByReference: true,
                    urlPrefix: 'openid4vp://',
                }),
            });
            if (isAdapterFailure(response)) {
                return response;
            }
            const requestUri = getVerificationRequestUri(response);
            const openId4VpUri = getOpenId4VpUri(response, requestUri);
            if (!requestUri || !openId4VpUri) {
                return createConfigurationError('iGrant verification response did not include OIDC4VP request details.');
            }
            const exchangeId = getPresentationExchangeId(response);
            return {
                status: 'pending',
                data: {
                    request: createPresentationRequest(requestUri, openId4VpUri, exchangeId, presentationDefinitionId),
                },
                message: exchangeId
                    ? `Created iGrant PID OIDC4VP request for exchange ${exchangeId}.`
                    : 'Created iGrant PID OIDC4VP request.',
            };
        },
        async requestPoa(_session, options) {
            if (options?.simulationMode === 'failure') {
                return createFailureResult('Simulated iGrant PoA verification failure.');
            }
            const config = await readConfig();
            if (isConfigError(config)) {
                return config;
            }
            const existingPoaRequest = _session.poa.data?.request;
            if (_session.poa.status === 'pending' && existingPoaRequest?.exchangeId) {
                const response = await requestVerificationHistory(config, existingPoaRequest.exchangeId);
                if (response.status === 'error') {
                    return response.error;
                }
                if (response.status === 'empty') {
                    return {
                        status: 'pending',
                        data: {
                            request: existingPoaRequest,
                        },
                        message: `Waiting for PoA verification exchange ${existingPoaRequest.exchangeId}.`,
                    };
                }
                const verificationHistory = response.history;
                if (!verificationHistory) {
                    return {
                        status: 'pending',
                        data: {
                            request: existingPoaRequest,
                        },
                        message: `Waiting for PoA verification exchange ${existingPoaRequest.exchangeId}.`,
                    };
                }
                if (!isVerificationReadyForExtraction(verificationHistory)) {
                    return {
                        status: 'pending',
                        data: {
                            request: existingPoaRequest,
                        },
                        message: `Waiting for PoA verification exchange ${existingPoaRequest.exchangeId}.`,
                    };
                }
                if (verificationHistory.verified !== true) {
                    return createFailureResult('PoA collection was received by the verifier, but credential verification failed.', {
                        code: 'IGRANT_POA_VERIFICATION_FAILED',
                        message: 'PoA collection was received by the verifier, but credential verification failed.',
                        retryable: false,
                        source: 'vendor-adapter',
                        detail: `Verification exchange ${existingPoaRequest.exchangeId} returned status ${String(verificationHistory.status)} with verified=${String(verificationHistory.verified)}.`,
                    });
                }
                const poaRecord = extractPoaRecordFromVerificationHistory(verificationHistory);
                if (!poaRecord) {
                    return createFailureResult('iGrant verification completed, but the PoA credential data could not be extracted.', {
                        code: 'IGRANT_POA_EXTRACTION_FAILED',
                        message: 'iGrant verification completed, but the PoA credential data could not be extracted.',
                        retryable: false,
                        source: 'vendor-adapter',
                    });
                }
                return {
                    status: 'succeeded',
                    data: {
                        record: poaRecord,
                    },
                    message: `Received PoA credential data from verification exchange ${existingPoaRequest.exchangeId}.`,
                };
            }
            if (!config.poaCredentialDefinitionId) {
                return createConfigurationError('IGRANT_POA_CREDENTIAL_DEFINITION_ID is missing.');
            }
            const verifierGlobalConfigurationResult = await ensureVerifierGlobalConfiguration(config);
            if (verifierGlobalConfigurationResult) {
                return verifierGlobalConfigurationResult;
            }
            const credentialDefinitionResponse = await readCredentialDefinition(config, config.poaCredentialDefinitionId);
            if (isAdapterFailure(credentialDefinitionResponse)) {
                return credentialDefinitionResponse;
            }
            const presentationDefinitionBody = buildPresentationDefinitionBody(credentialDefinitionResponse, `We Build Testing PoA verification ${_session.sessionId} ${Date.now()}`, 'poa');
            if ('status' in presentationDefinitionBody) {
                return presentationDefinitionBody;
            }
            const presentationDefinitionResponse = await requestIgrant(config, '/v2/config/digital-wallet/openid/sdjwt/presentation-definition', {
                method: 'POST',
                body: JSON.stringify(presentationDefinitionBody),
            });
            if (isAdapterFailure(presentationDefinitionResponse)) {
                return presentationDefinitionResponse;
            }
            const presentationDefinitionId = getPresentationDefinitionId(presentationDefinitionResponse);
            if (!presentationDefinitionId) {
                return createConfigurationError('iGrant presentation definition response did not include a presentationDefinitionId.');
            }
            const response = await requestIgrant(config, '/v3/config/digital-wallet/openid/sdjwt/verification/send', {
                method: 'POST',
                body: JSON.stringify({
                    presentationDefinitionId,
                    requestByReference: true,
                    urlPrefix: 'openid4vp://',
                }),
            });
            if (isAdapterFailure(response)) {
                return response;
            }
            const requestUri = getVerificationRequestUri(response);
            const openId4VpUri = getOpenId4VpUri(response, requestUri);
            if (!requestUri || !openId4VpUri) {
                return createConfigurationError('iGrant verification response did not include OIDC4VP request details.');
            }
            const exchangeId = getPresentationExchangeId(response);
            return {
                status: 'pending',
                data: {
                    request: createPresentationRequest(requestUri, openId4VpUri, exchangeId, presentationDefinitionId),
                },
                message: exchangeId
                    ? `Created iGrant PoA OIDC4VP request for exchange ${exchangeId}.`
                    : 'Created iGrant PoA OIDC4VP request.',
            };
        },
        async requestEucc(_session, options) {
            if (options?.simulationMode === 'failure') {
                return createFailureResult('Simulated iGrant EUCC verification failure.');
            }
            const config = await readConfig();
            if (isConfigError(config)) {
                return config;
            }
            const existingEuccRequest = _session.eucc.data?.request;
            if (_session.eucc.status === 'pending' && existingEuccRequest?.exchangeId) {
                const response = await requestVerificationHistory(config, existingEuccRequest.exchangeId);
                if (response.status === 'error') {
                    return response.error;
                }
                if (response.status === 'empty') {
                    return {
                        status: 'pending',
                        data: {
                            request: existingEuccRequest,
                        },
                        message: `Waiting for EUCC verification exchange ${existingEuccRequest.exchangeId}.`,
                    };
                }
                const verificationHistory = response.history;
                if (!verificationHistory) {
                    return {
                        status: 'pending',
                        data: {
                            request: existingEuccRequest,
                        },
                        message: `Waiting for EUCC verification exchange ${existingEuccRequest.exchangeId}.`,
                    };
                }
                if (!isVerificationReadyForExtraction(verificationHistory)) {
                    return {
                        status: 'pending',
                        data: {
                            request: existingEuccRequest,
                        },
                        message: `Waiting for EUCC verification exchange ${existingEuccRequest.exchangeId}.`,
                    };
                }
                if (verificationHistory.verified !== true) {
                    return createFailureResult('EUCC collection was received by the verifier, but credential verification failed.', {
                        code: 'IGRANT_EUCC_VERIFICATION_FAILED',
                        message: 'EUCC collection was received by the verifier, but credential verification failed.',
                        retryable: false,
                        source: 'vendor-adapter',
                        detail: `Verification exchange ${existingEuccRequest.exchangeId} returned status ${String(verificationHistory.status)} with verified=${String(verificationHistory.verified)}.`,
                    });
                }
                const euccRecord = extractEuccRecordFromVerificationHistory(verificationHistory);
                if (!euccRecord) {
                    return createFailureResult('iGrant verification completed, but the EUCC credential data could not be extracted.', {
                        code: 'IGRANT_EUCC_EXTRACTION_FAILED',
                        message: 'iGrant verification completed, but the EUCC credential data could not be extracted.',
                        retryable: false,
                        source: 'vendor-adapter',
                    });
                }
                return {
                    status: 'succeeded',
                    data: {
                        record: euccRecord,
                    },
                    message: `Received EUCC credential data from verification exchange ${existingEuccRequest.exchangeId}.`,
                };
            }
            if (!config.euccCredentialDefinitionId) {
                return createConfigurationError('IGRANT_EUCC_CREDENTIAL_DEFINITION_ID is missing.');
            }
            const verifierGlobalConfigurationResult = await ensureVerifierGlobalConfiguration(config);
            if (verifierGlobalConfigurationResult) {
                return verifierGlobalConfigurationResult;
            }
            const credentialDefinitionResponse = await readCredentialDefinition(config, config.euccCredentialDefinitionId);
            if (isAdapterFailure(credentialDefinitionResponse)) {
                return credentialDefinitionResponse;
            }
            const presentationDefinitionBody = buildPresentationDefinitionBody(credentialDefinitionResponse, `We Build Testing EUCC verification ${_session.sessionId} ${Date.now()}`, 'eucc');
            if ('status' in presentationDefinitionBody) {
                return presentationDefinitionBody;
            }
            const presentationDefinitionResponse = await requestIgrant(config, '/v2/config/digital-wallet/openid/sdjwt/presentation-definition', {
                method: 'POST',
                body: JSON.stringify(presentationDefinitionBody),
            });
            if (isAdapterFailure(presentationDefinitionResponse)) {
                return presentationDefinitionResponse;
            }
            const presentationDefinitionId = getPresentationDefinitionId(presentationDefinitionResponse);
            if (!presentationDefinitionId) {
                return createConfigurationError('iGrant presentation definition response did not include a presentationDefinitionId.');
            }
            const response = await requestIgrant(config, '/v3/config/digital-wallet/openid/sdjwt/verification/send', {
                method: 'POST',
                body: JSON.stringify({
                    presentationDefinitionId,
                    requestByReference: true,
                    urlPrefix: 'openid4vp://',
                }),
            });
            if (isAdapterFailure(response)) {
                return response;
            }
            const requestUri = getVerificationRequestUri(response);
            const openId4VpUri = getOpenId4VpUri(response, requestUri);
            if (!requestUri || !openId4VpUri) {
                return createConfigurationError('iGrant verification response did not include OIDC4VP request details.');
            }
            const exchangeId = getPresentationExchangeId(response);
            return {
                status: 'pending',
                data: {
                    request: createPresentationRequest(requestUri, openId4VpUri, exchangeId, presentationDefinitionId),
                },
                message: exchangeId
                    ? `Created iGrant EUCC OIDC4VP request for exchange ${exchangeId}.`
                    : 'Created iGrant EUCC OIDC4VP request.',
            };
        },
        async assembleReview(session, _options) {
            if (!session.pid.data?.record || !session.poa.data?.record || !session.eucc.data?.record) {
                return createFailureResult('Review assembly requires PID, PoA, and EUCC data.');
            }
            const matchedVatAttestation = await findVatAttestationForEucc(session.eucc.data.record);
            if (!matchedVatAttestation) {
                return createFailureResult('No VAT attestation mock was found for the company presented in the EUCC.', {
                    code: 'IGRANT_VAT_ATTESTATION_NOT_FOUND',
                    message: 'No VAT attestation mock was found for the company presented in the EUCC.',
                    retryable: false,
                    source: 'vendor-adapter',
                });
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
                message: 'Assembled review payload with a matched VAT attestation for iGrant-backed issuance.',
            };
        },
        async submitVatIssuance(session, _options) {
            const config = await readConfig();
            if (isConfigError(config)) {
                return config;
            }
            if (!config.vatCredentialDefinitionId) {
                return createConfigurationError('IGRANT_VAT_CREDENTIAL_DEFINITION_ID is missing.');
            }
            const attestation = session.review.data?.vatAttestation;
            if (!attestation) {
                return createFailureResult('VAT issuance requires a successful review with a matched VAT attestation.', {
                    code: 'IGRANT_VAT_REVIEW_REQUIRED',
                    message: 'VAT issuance requires a successful review with a matched VAT attestation.',
                    retryable: false,
                    source: 'vendor-adapter',
                });
            }
            const matchedFixture = await findVatAttestationByIdentity(attestation.economicOperatorId, attestation.vatId);
            if (!matchedFixture) {
                return createFailureResult('The matched VAT attestation could not be resolved for issuance.', {
                    code: 'IGRANT_VAT_ATTESTATION_RESOLUTION_FAILED',
                    message: 'The matched VAT attestation could not be resolved for issuance.',
                    retryable: false,
                    source: 'vendor-adapter',
                });
            }
            const credentialEntryId = await resolveCredentialEntryId(config, config.vatCredentialDefinitionId);
            if (typeof credentialEntryId !== 'string') {
                return credentialEntryId;
            }
            const response = await requestIgrant(config, '/v2/config/digital-wallet/openid/sdjwt/credential/issue', {
                method: 'POST',
                body: JSON.stringify({
                    issuanceMode: 'InTime',
                    urlScheme: 'openid-credential-offer://',
                    credentialDefinitionId: config.vatCredentialDefinitionId,
                    credentials: [
                        {
                            id: credentialEntryId,
                            credentialSubject: buildVatJwtVcCredentialSubject(attestation, matchedFixture.Administrative_Unit_Address, matchedFixture.Validity_Period, matchedFixture.Economic_Activity_Type, matchedFixture.Validity_Area_Limitation, matchedFixture.Issuer.Attestation_issuing_Organisation),
                        },
                    ],
                    userPin: '',
                }),
            });
            if ('error' in response) {
                return response;
            }
            const exchangeId = getCredentialExchangeId(response);
            if (!exchangeId) {
                return createConfigurationError('iGrant VAT issuance response did not include a credentialExchangeId.');
            }
            const offerUri = getCredentialOfferUri(response);
            const walletCredential = offerUri
                ? createVatWalletOfferSummary(attestation, offerUri, getQrCodeValue(response, offerUri), exchangeId, getCredentialUserPin(response, config))
                : undefined;
            return {
                status: 'pending',
                data: {
                    ...normalizeVatPending(attestation, exchangeId),
                    walletCredential,
                },
                message: `Started in-time iGrant VAT issuance for exchange ${exchangeId}.`,
            };
        },
        async readIssuanceStatus(session, _options) {
            const config = await readConfig();
            if (isConfigError(config)) {
                return config;
            }
            const exchangeId = session.vatIssuance.data?.exchangeId;
            if (!exchangeId) {
                return createConfigurationError('VAT issuance exchange id is missing from the session.');
            }
            const attestation = session.review.data?.vatAttestation;
            if (!attestation) {
                return createFailureResult('VAT issuance status lookup requires a successful review with a matched VAT attestation.', {
                    code: 'IGRANT_VAT_REVIEW_REQUIRED',
                    message: 'VAT issuance status lookup requires a successful review with a matched VAT attestation.',
                    retryable: false,
                    source: 'vendor-adapter',
                });
            }
            const response = await requestIgrant(config, `/v2/config/digital-wallet/openid/sdjwt/credential/history/${exchangeId}`, { method: 'GET' });
            if ('error' in response) {
                return response;
            }
            const rawStatus = extractStatus(response);
            const normalizedStatus = normalizeVatIssuanceHistoryStatus(rawStatus);
            if (normalizedStatus === vatIssuanceHistoryStatus.credentialDeleted
                || normalizedStatus === vatIssuanceHistoryStatus.issuanceDenied) {
                return createFailureResult(`iGrant reported issuance failure for exchange ${exchangeId} with status ${rawStatus}.`, {
                    code: 'IGRANT_ISSUANCE_FAILED',
                    message: `iGrant reported issuance failure for exchange ${exchangeId} with status ${rawStatus}.`,
                    retryable: true,
                    source: 'vendor-adapter',
                });
            }
            if (normalizedStatus !== vatIssuanceHistoryStatus.credentialAccepted) {
                return {
                    status: 'pending',
                    data: {
                        ...normalizeVatPending(attestation, exchangeId),
                        walletCredential: session.vatIssuance.data?.walletCredential,
                    },
                    message: `iGrant VAT issuance is still pending for exchange ${exchangeId} with history status ${rawStatus}.`,
                };
            }
            return {
                status: 'succeeded',
                data: {
                    ...normalizeVatIssued(attestation, exchangeId),
                    walletCredential: createIssuedVatWalletCredential(attestation),
                },
                message: `iGrant VAT issuance completed for exchange ${exchangeId}.`,
            };
        },
    };
}
