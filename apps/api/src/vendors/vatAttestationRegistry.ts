import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import type { EuccRecord, VatAttestationRecord } from '@we-build/domain';

export type VatFixture = {
  VAT_ID: string;
  Administrative_Unit_Name: string;
  Administrative_Unit_Type: string;
  Administrative_Unit_Address?: Record<string, unknown>;
  Validity_Area_Limitation?: unknown[];
  Validity_Period?: Array<Record<string, unknown>>;
  Economic_Activity_Type?: Array<Record<string, unknown>>;
  Economic_Operator: {
    EUID: string;
    Economic_Operator_Name: string;
  };
  Issuer: {
    Issuing_country: string;
    Issuing_Organisation: string;
    Issuing_date: string;
    Attestation_issuing_Organisation?: string;
  };
};

const additionalVatFixture: VatFixture = {
  VAT_ID: 'FI76543219',
  Administrative_Unit_Name: 'Northern Birch Consulting Oy Espoo Office',
  Administrative_Unit_Type: 'branch',
  Administrative_Unit_Address: {
    thoroughfare: 'Koivukuja 11',
    post_code: '02100',
    post_name: 'Espoo',
    admin_unit_L1: 'Uusimaa',
    admin_unit_L2: 'Finland',
  },
  Validity_Area_Limitation: [],
  Validity_Period: [
    {
      VAT_ID_start_date: '2024-01-08',
    },
  ],
  Economic_Activity_Type: [
    {
      Economic_Activity_Type_Nomenclature: 'NACE',
      Economic_Activity_Type_ID: '70.22',
      Economic_Activity_Type_Description: [
        {
          Language: 'en',
          Description: 'Business and other management consultancy activities',
        },
      ],
    },
  ],
  Economic_Operator: {
    EUID: 'FIHPR.7654321-9',
    Economic_Operator_Name: 'Northern Birch Consulting Oy',
  },
  Issuer: {
    Issuing_country: 'FI',
    Issuing_Organisation: 'Finnish Tax Administration',
    Issuing_date: '2026-04-20',
    Attestation_issuing_Organisation: 'Finnish Tax Administration Digital Credentials Service',
  },
};

let vatAttestationPromise: Promise<VatFixture[]> | undefined;

function normalizeComparable(value: string | undefined): string {
  return (value ?? '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

async function loadJsonFixture<T>(relativePath: string): Promise<T> {
  const absolutePath = fileURLToPath(new URL(relativePath, import.meta.url));
  const content = await readFile(absolutePath, 'utf-8');
  return JSON.parse(content) as T;
}

export async function loadVatAttestationCatalog(): Promise<VatFixture[]> {
  vatAttestationPromise ??= loadJsonFixture<VatFixture>('../../../../mock-data/vat-attestation-credential.mock.json')
    .then((fixture) => [fixture, additionalVatFixture]);

  return vatAttestationPromise;
}

export function normalizeVatAttestationRecord(fixture: VatFixture): VatAttestationRecord {
  return {
    vatId: fixture.VAT_ID,
    administrativeUnitName: fixture.Administrative_Unit_Name,
    administrativeUnitType: fixture.Administrative_Unit_Type,
    economicOperatorId: fixture.Economic_Operator.EUID,
    economicOperatorName: fixture.Economic_Operator.Economic_Operator_Name,
    issuingCountry: fixture.Issuer.Issuing_country,
    issuingOrganisation: fixture.Issuer.Issuing_Organisation,
    attestationIssuingOrganisation: fixture.Issuer.Attestation_issuing_Organisation,
    issuedAt: fixture.Issuer.Issuing_date,
  };
}

export async function findVatAttestationForEucc(record: EuccRecord): Promise<VatFixture | undefined> {
  const vatAttestations = await loadVatAttestationCatalog();
  const companyId = normalizeComparable(record.companyId);
  const companyName = normalizeComparable(record.companyName);

  return vatAttestations.find((fixture) => {
    const operatorId = normalizeComparable(fixture.Economic_Operator.EUID);
    const operatorName = normalizeComparable(fixture.Economic_Operator.Economic_Operator_Name);

    return operatorId === companyId || operatorName === companyName;
  });
}

export async function findVatAttestationByIdentity(
  economicOperatorId: string,
  vatId: string,
): Promise<VatFixture | undefined> {
  const vatAttestations = await loadVatAttestationCatalog();
  const normalizedOperatorId = normalizeComparable(economicOperatorId);
  const normalizedVatId = normalizeComparable(vatId);

  return vatAttestations.find((fixture) => (
    normalizeComparable(fixture.Economic_Operator.EUID) === normalizedOperatorId
    && normalizeComparable(fixture.VAT_ID) === normalizedVatId
  ));
}