---
vct: urn:we-build-fta:credential:vat-attestation:1
background_color: "#F8FAFC"
text_color: "#0E3A8A"
---

# VAT Attestation

VAT identification attestation for an administrative unit of an economic operator.

## Claims

- `VAT_ID` (string): Full VAT identification of the company including country identifier, without spaces or separators. [mandatory] [sd=always]
- `Administrative_Unit_Name` (string): Name of the administrative unit as registered by the tax administration. [mandatory] [sd=always]
- `Administrative_Unit_Type` (string): Type of administrative unit ID. [sd=always]
- `Administrative_Unit_Address.po_box` (string): Administrative unit address post office box. [sd=always]
- `Administrative_Unit_Address.thoroughfare` (string): Administrative unit address thoroughfare. [sd=always]
- `Administrative_Unit_Address.location_designator` (string): Administrative unit address location designator. [sd=always]
- `Administrative_Unit_Address.post_code` (string): Administrative unit address post code. [sd=always]
- `Administrative_Unit_Address.post_name` (string): Administrative unit address post name. [sd=always]
- `Administrative_Unit_Address.admin_unit_L1` (string): Administrative unit address level 1 administrative unit. [sd=always]
- `Administrative_Unit_Address.admin_unit_L2` (string): Administrative unit address level 2 administrative unit. [sd=always]
- `Validity_Area_Limitation` (array<string>): Country codes in which the VAT_ID may be used. [sd=always]
- `Validity_Period.VAT_ID_start_date` (date): Start date of VAT ID validity period. [mandatory] [sd=always]
- `Validity_Period.VAT_ID_end_date` (date): End date of VAT ID validity period when available. [sd=always]
- `Economic_Activity_Type.Economic_Activity_Type_Nomenclature` (string): Activity nomenclature system (for example NACE). [sd=always]
- `Economic_Activity_Type.Economic_Activity_Type_ID` (string): Activity type identifier in the chosen nomenclature. [sd=always]
- `Economic_Activity_Type.Economic_Activity_Type_Description.Language` (string): Language for activity description. [sd=always]
- `Economic_Activity_Type.Economic_Activity_Type_Description.Description` (string): Human-readable activity description. [sd=always]
- `Economic_Operator.EUID` (string): Economic operator identifier for legal entities. [sd=always]
- `Economic_Operator.PID` (string): Economic operator identifier for sole traders. [sd=always]
- `Economic_Operator.Economic_Operator_Name` (string): Name of the economic operator. [mandatory] [sd=always]
- `Issuer.Issuing_country` (string): Country code of issuing authority. [mandatory] [sd=always]
- `Issuer.Issuing_Organisation` (string): Authentic source organisation. [mandatory] [sd=always]
- `Issuer.Issuing_date` (date): Date the attestation was issued. [mandatory] [sd=always]
- `Issuer.Attestation_issuing_Organisation` (string): Organisation issuing the attestation artifact. [mandatory] [sd=always]

## Images

![WE BUILD Logo](../apps/web/public/resources/images/we-build-logomark-light-bg.png)
