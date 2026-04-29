import { describe, expect, it } from 'vitest';

import {
  createInitialSession,
  updateSessionStep,
  type CompanyContext,
  type EuccRecord,
  type PidRecord,
  type PoaRecord,
  type ReviewPayload,
  type VatIssuanceResult,
} from '../src/index.js';

const now = '2026-04-21T10:00:00.000Z';

const pidRecord: PidRecord = {
  givenName: 'Teemu',
  familyName: 'Tester',
  fullName: 'Teemu Tester',
  dateOfBirth: '1990-01-01',
  nationality: 'FI',
  residentCountry: 'FI',
  ageOver18: true,
  issuerName: 'Mock PID Issuer',
  issuerId: 'issuer-1',
  issuedAt: now,
  expiresAt: '2030-01-01T00:00:00.000Z',
};

const companyContext: CompanyContext = {
  companyId: 'FI123',
  companyName: 'Teemun Tomaatit Oy',
  legalForm: 'Oy',
  jurisdiction: 'FI',
  registeredOffice: 'Example Street 1, Helsinki',
};

const poaRecord: PoaRecord = {
  companyId: 'FI123',
  companyName: 'Teemun Tomaatit Oy',
  principalName: 'Teemun Tomaatit Oy',
  attorneyName: 'Teemu Tester',
  attorneyDateOfBirth: '1990-01-01',
  scope: ['vat-registration'],
  substitutionAllowed: false,
  validFrom: now,
  validUntil: '2027-01-01T00:00:00.000Z',
  lawJurisdiction: 'FI',
  signingPlace: 'Helsinki',
  signingDate: now,
};

const euccRecord: EuccRecord = {
  companyId: 'FI123',
  companyName: 'Teemun Tomaatit Oy',
  legalForm: 'Oy',
  registrationMemberState: 'FI',
  registeredAddress: 'Example Street 1, Helsinki',
  registrationDate: now,
  legalPersonStatus: 'active',
  activityCodes: ['A01'],
  representativeNames: ['Teemu Tester'],
};

const reviewPayload: ReviewPayload = {
  person: pidRecord,
  company: companyContext,
  poa: poaRecord,
  eucc: euccRecord,
  assembledAt: now,
};

const vatIssuanceResult: VatIssuanceResult = {
  vatId: 'FI999',
  administrativeUnitName: 'Helsinki Tax Office',
  administrativeUnitType: 'Tax office',
  issuingCountry: 'FI',
  issuingOrganisation: 'Finnish Tax Administration',
  exchangeId: 'exchange-1',
  issuedAt: now,
  status: 'issued',
};

describe('session state machine', () => {
  it('unlocks dependent steps as upstream steps succeed', () => {
    const session = createInitialSession('mock-local', now);
    expect(session.pid.status).toBe('ready');
    expect(session.poa.status).toBe('blocked');
    expect(session.eucc.status).toBe('blocked');

    const afterPid = updateSessionStep(session, {
      step: 'pid',
      status: 'succeeded',
      data: pidRecord,
      message: 'PID succeeded.',
      updatedAt: now,
    });

    expect(afterPid.poa.status).toBe('ready');
    expect(afterPid.eucc.status).toBe('ready');
    expect(afterPid.lifecycle).toBe('in-progress');
    expect(afterPid.eventLog.at(-1)?.message).toBe('PID succeeded.');

    const afterEucc = updateSessionStep(afterPid, {
      step: 'eucc',
      status: 'succeeded',
      data: { record: euccRecord },
      updatedAt: now,
    });

    expect(afterEucc.companyContext).toEqual(companyContext);
  });

  it('derives lifecycle through review, pending issuance, and completion', () => {
    let session = createInitialSession('mock-local', now);

    session = updateSessionStep(session, { step: 'pid', status: 'succeeded', data: pidRecord, updatedAt: now });
    session = updateSessionStep(session, { step: 'poa', status: 'succeeded', data: poaRecord, updatedAt: now });
    session = updateSessionStep(session, { step: 'eucc', status: 'succeeded', data: { record: euccRecord }, updatedAt: now });
    session = updateSessionStep(session, { step: 'review', status: 'succeeded', data: reviewPayload, updatedAt: now });

    expect(session.lifecycle).toBe('ready-for-review');

    session = updateSessionStep(session, {
      step: 'vatIssuance',
      status: 'pending',
      data: { ...vatIssuanceResult, status: 'pending', issuedAt: undefined },
      updatedAt: now,
    });

    expect(session.lifecycle).toBe('submitting');

    session = updateSessionStep(session, {
      step: 'vatIssuance',
      status: 'succeeded',
      data: vatIssuanceResult,
      updatedAt: now,
    });

    expect(session.lifecycle).toBe('completed');
  });
});