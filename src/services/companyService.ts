import { mockResponse } from "../lib/apiClient";
import type { CompanyInfo } from "../types";

/*
 * Corporate profile as published on azeetrade.com. Static today;
 * kept behind the service layer so contact and regulatory copy can
 * move to a CMS without touching consumers.
 */

const COMPANY_INFO: CompanyInfo = {
  legalName: "AZEE Securities (Pvt.) Ltd.",
  brand: "AZEE Trade",
  tagline: "PSX Trading & Research",
  address: "Suite 705, 7th Floor, Business & Finance Centre, Karachi",
  phone: "+92 111-293-293",
  email: "info@azeetrade.com",
  memberSince: 2003,
  regulatory: {
    psxTrecNumber: "108",
    secpRegistration: "0041920",
    cdcParticipantId: "04184",
    nccplCode: "C0418401",
  },
};

/** Identity, contact, and regulatory profile. */
export async function getCompanyInfo(): Promise<CompanyInfo> {
  // return apiGet<CompanyInfo>("/company/profile");
  return mockResponse(COMPANY_INFO);
}
