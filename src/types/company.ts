/** Licences and registrations displayed in trust and footer copy. */
export interface RegulatoryInfo {
  psxTrecNumber: string;
  secpRegistration: string;
  cdcParticipantId: string;
  nccplCode: string;
}

/** Corporate identity, contact, and regulatory profile. */
export interface CompanyInfo {
  legalName: string;
  brand: string;
  tagline: string;
  address: string;
  phone: string;
  email: string;
  memberSince: number;
  regulatory: RegulatoryInfo;
}
