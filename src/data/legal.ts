import type { LegalPage } from "../types/legal";

/**
 * The legal / regulatory page registry — one typed array, not nine
 * components, mirroring the Knowledge Centre module registry.
 *
 * PROVENANCE, which matters more here than anywhere else on this site:
 * every page carrying `blocks` reproduces wording that already exists
 * and has already been approved — ported from azeetrade.com (verified
 * live) or from the regulatory prose already published in this site's
 * own footer. Only branding, URLs and formatting were adapted; no
 * substantive legal wording was rewritten, condensed or invented.
 *
 * Pages carrying `pending` instead have NO approved source yet. They
 * exist as real routes with an honest outstanding-content state and a
 * precise list of what is needed. Do not "fill them in" — on a
 * licensed brokerage, plausible-sounding legal text is worse than an
 * empty page, because an empty page cannot mislead a client.
 */
export const LEGAL_PAGES: LegalPage[] = [
  /* ── Ported from azeetrade.com/privacy-policy.php ─────────────── */
  {
    slug: "privacy-policy",
    path: "/privacy-policy",
    title: "Privacy Policy",
    eyebrow: "Legal",
    description:
      "How AZEE Securities collects, uses, shares and protects your personal data, and the rights you have over it.",
    effectiveDate: "04 July 2025",
    sourceNote: "Ported verbatim from azeetrade.com/privacy-policy.php",
    blocks: [
      { kind: "heading", text: "1. Information We Collect" },
      {
        kind: "list",
        items: [
          "Personal data (e.g., name, CNIC, email, phone) submitted during registration, account opening, or queries.",
          "Trading and transaction data through our online portal and mobile app (Stockify).",
          "Device and browsing data via cookies and analytics tools.",
        ],
      },
      { kind: "heading", text: "2. How We Use Your Data" },
      {
        kind: "list",
        items: [
          "To process KYC, regulatory compliance, and service requests.",
          "To enhance user experience and offer customized investment content.",
          "To comply with SECP, PSX, PMEX, and other legal/regulatory obligations.",
        ],
      },
      { kind: "heading", text: "3. Data Sharing" },
      {
        kind: "list",
        items: [
          "Your information may be shared with regulatory bodies (e.g., PSX, NCCPL, CDC) as required by law.",
          "We do not sell your data to third parties.",
        ],
      },
      { kind: "heading", text: "4. Security" },
      {
        kind: "paragraph",
        text: "We use SSL encryption and secure servers to protect your data. However, no digital transmission is 100% secure.",
      },
      { kind: "heading", text: "5. Your Rights" },
      {
        kind: "paragraph",
        text: "You may request to review, update, or delete your personal data by contacting our compliance department.",
      },
    ],
  },

  /* ── Ported from azeetrade.com/term-of-use.php ────────────────── */
  {
    slug: "terms-of-use",
    path: "/terms-of-use",
    title: "Terms of Use",
    eyebrow: "Legal",
    description:
      "The terms governing your use of the AZEE Securities website, including intellectual property, user responsibilities and limitation of liability.",
    effectiveDate: "04 July 2025",
    sourceNote: "Ported verbatim from azeetrade.com/term-of-use.php",
    blocks: [
      { kind: "heading", text: "Company Overview" },
      {
        kind: "paragraph",
        text: "Azee Securities (Pvt.) Limited is a Corporate Member and TREC Holder of the Pakistan Stock Exchange (PSX) and a member of Pakistan Mercantile Exchange Limited (PMEX).",
      },
      { kind: "heading", text: "Overview" },
      {
        kind: "paragraph",
        text: "By accessing and using this website (the “Site”), you agree to be bound by these Terms of Use. If you do not accept these terms, please discontinue use of the site.",
      },
      { kind: "heading", text: "1. Use of the Website" },
      {
        kind: "list",
        items: [
          "The content provided on this site is for informational purposes only.",
          "You agree not to misuse, modify, or replicate content from this website.",
          "Unlawful or unauthorized use of the site may give rise to legal claims.",
        ],
      },
      { kind: "heading", text: "2. Intellectual Property" },
      {
        kind: "list",
        items: [
          "All trademarks, content, data, and designs are the property of Azee Securities and/or its partners.",
          "You may not reproduce or redistribute any content without prior written permission.",
        ],
      },
      { kind: "heading", text: "3. User Responsibilities" },
      {
        kind: "list",
        items: [
          "You agree to use this site lawfully and ethically.",
          "You are responsible for maintaining confidentiality of your login credentials where applicable.",
        ],
      },
      { kind: "heading", text: "4. Limitation of Liability" },
      {
        kind: "list",
        items: [
          "Azee Securities shall not be liable for any direct, indirect, or incidental damages arising out of your use of the website.",
          "Market data may be delayed or inaccurate and is provided “as is”.",
        ],
      },
      { kind: "heading", text: "5. Modifications" },
      {
        kind: "paragraph",
        text: "We reserve the right to update or change these Terms at any time. Continued use of the site after updates constitutes acceptance of the new terms.",
      },
    ],
  },

  /* ── Ported from azeetrade.com/disclaimer-risk-disclosure.php ─── */
  {
    slug: "risk-disclosure",
    path: "/risk-disclosure",
    title: "Disclaimer & Risk Disclosure",
    eyebrow: "Legal",
    description:
      "AZEE Securities' regulatory status, disclaimer, and the risks of investing in securities and commodities — issued under Clause 13(1) of the Securities Brokers (Licensing and Operations) Regulations, 2016.",
    sourceNote:
      "Ported verbatim from azeetrade.com/disclaimer-risk-disclosure.php",
    blocks: [
      {
        kind: "paragraph",
        text: "At Azee Securities, we prioritize transparency and investor awareness. This Disclaimer & Risk Disclosure outlines our regulatory status, important legal information, and the risks associated with investing in stock and commodity markets.",
      },
      { kind: "heading", text: "Regulatory Details" },
      {
        kind: "list",
        items: [
          "SECP Licensed Securities Broker under the Securities Brokers (Licensing and Operations) Regulations, 2016.",
          "TREC Holder: Pakistan Stock Exchange Limited.",
          "Member: Pakistan Mercantile Exchange Limited.",
          "Market Participant: Central Depository Company of Pakistan Limited (CDC).",
          "Clearing Member: National Clearing Company of Pakistan Limited (NCCPL).",
        ],
      },
      { kind: "heading", text: "Disclaimer" },
      {
        kind: "list",
        items: [
          "Investments in the stock market are subject to market risks. Past performance is not indicative of future performance. Please read all relevant risk disclosure documents carefully before investing.",
          "Brokerage commission, fees, and charges will not exceed the limits prescribed by the Pakistan Stock Exchange (PSX) and the Securities and Exchange Commission of Pakistan (SECP).",
          "Azee Securities may act as a distributor for non-broking products/services such as Mutual Funds, IPOs, Bonds, and other third-party financial products. These are not exchange-traded instruments, and Azee Securities only acts in the capacity of a distributor. Any disputes relating to such distribution activity may not have access to the PSX/NCCPL investor redressal forum or arbitration mechanism.",
          "Azee Securities (Pvt.) Limited does not provide any Portfolio Management Services nor is it licensed as an Investment Adviser.",
        ],
      },
      { kind: "heading", text: "Risk Disclosure" },
      {
        kind: "paragraph",
        text: "In compliance with Clause 13(1) of the Securities Brokers (Licensing and Operations) Regulations, 2016, clients are cautioned as follows:",
      },
      {
        kind: "list",
        items: [
          "Market Risk: The prices of securities/commodities are subject to market fluctuations and may rise or fall. Investors may sustain losses, including a possible loss of the entire principal amount invested.",
          "Volatility Risk: Securities and commodity markets can be highly volatile. The value of investments may fluctuate substantially within short periods of time, leading to gains or losses.",
          "Liquidity Risk: Certain securities may not be actively traded, resulting in difficulty in buying or selling such investments without materially affecting their price.",
          "System & Operational Risks: Trading systems, communication failures, technical problems, or errors at brokers, exchanges, or depositories may delay, suspend, or impact execution of client orders.",
          "Regulatory Risk: Changes in laws, rules, and regulations of SECP, PSX, PMEX, CDC, and NCCPL may affect investment decisions or returns.",
          "No Guarantee of Return: There is no guarantee of profits or fixed returns in securities or commodities trading. Past performance of the market or any security is not a reliable indicator of future performance.",
          "Client Responsibility: The client shall be solely responsible for their investment decisions and for understanding the risks involved. The broker shall not be liable for any losses incurred as a result of trading activities carried out on the client’s behalf.",
        ],
      },
      { kind: "heading", text: "Acknowledgement" },
      {
        kind: "paragraph",
        text: "By opening and operating a trading account with Azee Securities, the client acknowledges that they have read, understood, and accepted the risks associated with investing in the stock and commodity markets.",
      },
    ],
  },

  /* ── Consolidated from already-published regulatory prose ─────── */
  {
    slug: "regulatory-information",
    path: "/regulatory-information",
    title: "Regulatory Information",
    eyebrow: "Compliance",
    description:
      "AZEE Securities' licences, registration numbers, registered and corporate offices, and compliance officer details.",
    sourceNote:
      "Consolidated from azeetrade.com's published regulatory panel and this site's existing footer disclosure",
    blocks: [
      {
        kind: "paragraph",
        text: "Azee Securities (Pvt.) Ltd. is a TREC Holder of the Pakistan Stock Exchange (PSX) and is regulated by the Securities and Exchange Commission of Pakistan (SECP). We are also a registered participant of the Central Depository Company of Pakistan Limited (CDC) and the National Clearing Company of Pakistan Limited (NCCPL).",
      },
      { kind: "heading", text: "Registration & Membership" },
      {
        kind: "definitions",
        items: [
          { term: "Pakistan Stock Exchange (PSX)", value: "TREC Holder No. 108" },
          { term: "SECP Registration No.", value: "0041920" },
          { term: "CDC Participant ID", value: "04184" },
          { term: "NCCPL Participant Code", value: "C0418401" },
          {
            term: "Licence",
            value:
              "SECP Licensed Securities Broker under the Securities Brokers (Licensing and Operations) Regulations, 2016",
          },
          {
            term: "Pakistan Mercantile Exchange (PMEX)",
            value: "Member",
          },
        ],
      },
      { kind: "heading", text: "Offices" },
      {
        kind: "definitions",
        items: [
          {
            term: "Registered Office",
            value:
              "Room No. 33, Ground Floor, Stock Exchange Building, Stock Exchange Road, Karachi – 74000, Pakistan",
          },
          {
            term: "Corporate Office",
            value:
              "Office #705, 7th Floor, Business & Finance Centre, I.I. Chundrigar Road, Karachi, Pakistan",
          },
        ],
      },
      { kind: "heading", text: "Compliance Officer" },
      {
        kind: "definitions",
        items: [
          { term: "Name", value: "Mr. Ghazi Naseem" },
          { term: "Telephone", value: "+92-309-2474783" },
          { term: "Email", value: "ghazi@azeetrade.com" },
        ],
      },
      { kind: "heading", text: "Scope of Licence" },
      {
        kind: "list",
        items: [
          "Azee Securities (Pvt.) Limited does not provide any Portfolio Management Services nor is it licensed as an Investment Adviser.",
          "Registration with SECP, PSX, CDC, or NCCPL does not guarantee performance or returns.",
        ],
      },
    ],
  },

  /* ── Complaint process, from published dispute-resolution text ── */
  {
    slug: "complaints",
    path: "/complaints",
    title: "Complaints & Escalation",
    eyebrow: "Compliance",
    description:
      "How to raise a complaint with AZEE Securities' compliance department and how to escalate it to the SECP if it remains unresolved.",
    sourceNote:
      "Based on the dispute-resolution and investor-protection wording already published by AZEE",
    blocks: [
      { kind: "heading", text: "Step 1 — Contact our Compliance Department" },
      {
        kind: "paragraph",
        text: "Please raise your complaint with our Compliance Department in the first instance, giving your account details and a description of the issue.",
      },
      {
        kind: "definitions",
        items: [
          { term: "Compliance Officer", value: "Mr. Ghazi Naseem" },
          { term: "Email", value: "ghazi@azeetrade.com" },
          { term: "Telephone", value: "+92-309-2474783" },
          { term: "General enquiries", value: "info@azeetrade.com" },
        ],
      },
      { kind: "heading", text: "Step 2 — Escalate to the SECP" },
      {
        kind: "paragraph",
        text: "If your complaint is not resolved to your satisfaction, you may escalate it to the Securities and Exchange Commission of Pakistan through its Service Desk Management System.",
      },
      {
        kind: "definitions",
        items: [
          {
            term: "SECP Complaint System",
            value: "https://sdms.secp.gov.pk",
          },
          {
            term: "CDC Investor Awareness",
            value: "https://cdcpakistan.com",
          },
        ],
      },
      { kind: "heading", text: "Investor Guidelines" },
      {
        kind: "list",
        items: [
          "Keep KYC records updated in line with SECP directives.",
          "Never share your login ID, password, OTP, or trading PIN with anyone.",
          "Avoid unauthorized schemes promising fixed returns.",
          "Register your mobile number and email with Azee Securities and CDC to receive alerts.",
          "Fulfil margin requirements only via the CDC pledge process.",
        ],
      },
      /*
       * azeetrade.com's site-wide footer also carries a "Beware of
       * Fraudulent Activities" warning about trading tips/signals on
       * WhatsApp, Telegram and social media. It is deliberately NOT
       * reproduced on this site — excluded by instruction. Do not
       * re-add it here or on any other page when porting further
       * content from azeetrade.com, where it appears on every page.
       */
    ],
  },

  /* ── Written from an actual audit of this site's integrations ─── */
  {
    slug: "cookie-policy",
    path: "/cookie-policy",
    title: "Cookie Policy",
    eyebrow: "Legal",
    description:
      "What this website stores in your browser, why, and how to control it — describing exactly what AZEE Trade actually runs.",
    sourceNote:
      "Written from a direct audit of this site's integrations, not from boilerplate",
    blocks: [
      {
        kind: "paragraph",
        text: "This policy describes what this website actually stores in your browser. It was written by auditing the site's own code and its live behaviour, rather than adapted from a generic template, so it should match what you would find if you inspected the site yourself.",
      },
      { kind: "heading", text: "This site does not use cookies" },
      {
        kind: "paragraph",
        text: "AZEE Trade sets no cookies. We use no advertising, marketing or analytics cookies, and no third-party tracking or advertising services of any kind.",
      },
      { kind: "heading", text: "What we do store" },
      {
        kind: "paragraph",
        text: "We use Sentry, an error-monitoring service, to detect and diagnose faults on this website. Sentry stores a single entry in your browser's session storage, named sentryReplaySession. Session storage is cleared automatically when you close the browser tab.",
      },
      {
        kind: "definitions",
        items: [
          {
            term: "sentryReplaySession",
            value:
              "Session storage. Identifies a single browsing session so that, if an error occurs, the sequence of events leading to it can be reviewed. Cleared when the tab is closed.",
          },
        ],
      },
      { kind: "heading", text: "Session Replay" },
      {
        kind: "paragraph",
        text: "Sentry's Session Replay feature records a reconstruction of the pages you view on this site so faults can be diagnosed as a real user experienced them. Recording is limited: a sample of ordinary sessions is retained, and a session is retained if it encounters an error.",
      },
      {
        kind: "paragraph",
        text: "Replay masks content by default. All text and all form inputs are masked, and media is blocked, before anything leaves your browser — so the recording shows layout and interaction, not the words on the page or anything you type. This site also has no login, no payment flow and no forms that collect personal data.",
      },
      { kind: "heading", text: "What we do not do" },
      {
        kind: "list",
        items: [
          "We do not use analytics services such as Google Analytics, Google Tag Manager, or any equivalent.",
          "We do not use advertising, remarketing or social media tracking pixels.",
          "We do not sell or share browsing data with third parties for marketing purposes.",
          "We do not build advertising profiles about visitors.",
        ],
      },
      { kind: "heading", text: "Your choices" },
      {
        kind: "paragraph",
        text: "You can decline error-monitoring session recording using the cookie banner shown on your first visit, and your choice is remembered in your browser. You can also clear this site's stored data at any time through your browser settings, and browsers offer controls to block storage per site.",
      },
      { kind: "heading", text: "Questions" },
      {
        kind: "paragraph",
        text: "For any question about this policy or about data held by AZEE Securities, please contact our compliance department at info@azeetrade.com.",
      },
    ],
  },

  /* ── Real forms, linked where AZEE already publishes them ─────── */
  {
    slug: "forms-downloads",
    path: "/forms-downloads",
    title: "Forms & Downloads",
    eyebrow: "Support",
    description:
      "Download AZEE Securities account opening, KYC, and account maintenance forms.",
    sourceNote:
      "Links to the forms AZEE already publishes at azeetrade.com; all verified to download",
    blocks: [
      {
        kind: "paragraph",
        text: "Download the relevant form, complete it, and submit it to our registered office. Each link opens the current version of the form as published by AZEE Securities.",
      },
      { kind: "heading", text: "Account Opening & KYC" },
      {
        kind: "downloads",
        items: [
          {
            label: "Trading Account Opening Form (Individuals)",
            href: "https://azeetrade.com/admin/assets/uploads/Trading Account Opening Form Individual.pdf",
          },
          {
            label: "Know Your Customer (KYC) Form",
            href: "https://azeetrade.com/admin/assets/uploads/Know Your Customer = KYC Form.pdf",
          },
          {
            label: "Zakat Declaration Form (CZ-50)",
            href: "https://azeetrade.com/admin/assets/uploads/Zakat Declaration Form-CZ50.pdf",
          },
        ],
      },
      { kind: "heading", text: "Account Maintenance" },
      {
        kind: "downloads",
        items: [
          {
            label: "Change of Address Form (Individuals)",
            href: "https://azeetrade.com/admin/assets/uploads/Change of Address Form - Individuals.pdf",
          },
          {
            label: "Change of Email Address Form (Individuals)",
            href: "https://azeetrade.com/admin/assets/uploads/Change of Email Address Form - Individuals.pdf",
          },
          {
            label: "Change of Bank Details Form (Individuals)",
            href: "https://azeetrade.com/admin/assets/uploads/Change of Bank Details Form - Individuals.pdf",
          },
          {
            label: "Change of Mobile Number Form (Individuals)",
            href: "https://azeetrade.com/admin/assets/uploads/Change of Mobile Number Form - Individuals.pdf",
          },
          {
            label: "Share Transfer Form (Individuals)",
            href: "https://azeetrade.com/admin/assets/uploads/Share Transfer Form - Individuals.pdf",
          },
        ],
      },
      { kind: "heading", text: "Affidavits & Declarations" },
      {
        kind: "downloads",
        items: [
          {
            label:
              "Affidavit for Dependants (housewife / household / student)",
            href: "https://azeetrade.com/admin/assets/uploads/Affidavit for Dependants (housewife-house hold-student).pdf",
          },
          {
            label: "Affidavit — Mobile Number Provision for Family Members",
            href: "https://azeetrade.com/admin/assets/uploads/Affidavit Mobile Number Provision for Family Members.pdf",
          },
          {
            label: "Affidavit for Biometric Exception",
            href: "https://azeetrade.com/admin/assets/uploads/Affidavit for Biometric Exception.pdf",
          },
          {
            label: "Solemn Affirmation for Non-Muslims",
            href: "https://azeetrade.com/admin/assets/uploads/Solemn Affirmation for Non- Muslims.pdf",
          },
        ],
      },
    ],
  },

  /* ── No approved source exists yet — honest pending state ─────── */
  {
    slug: "aml-kyc",
    path: "/aml-kyc",
    title: "AML / KYC Policy",
    eyebrow: "Compliance",
    description:
      "AZEE Securities' anti-money-laundering and know-your-customer policy.",
    pending: {
      summary:
        "AZEE operates AML and KYC procedures as a condition of its SECP licence, and KYC is referenced in our Privacy Policy and account-opening forms. The formal policy document is not yet published on this site.",
      needed: [
        "The approved AML/CFT policy document, or the sections of it intended for public disclosure",
        "Customer Due Diligence and Enhanced Due Diligence procedures as disclosed to clients",
        "Record-retention periods applied to client identification records",
        "The designated AML Compliance Officer's name and contact details, if different from the Compliance Officer listed on the Regulatory Information page",
        "Suspicious Transaction Report handling and the reporting relationship with the Financial Monitoring Unit (FMU)",
      ],
    },
  },
  {
    slug: "fee-schedule",
    path: "/fee-schedule",
    title: "Schedule of Charges",
    eyebrow: "Compliance",
    description:
      "AZEE Securities' brokerage commission rates, taxes and other charges.",
    pending: {
      summary:
        "AZEE has published that brokerage commission, fees and charges will not exceed the limits prescribed by the Pakistan Stock Exchange and the SECP. The specific rate card is not yet published on this site, and rates are not inferred here.",
      needed: [
        "Equity brokerage commission rates, including any minimum per-trade charge and any tiering by volume or channel",
        "PMEX commodity futures commission rates, per contract or per lot",
        "CDC and NCCPL charges passed through to clients",
        "Applicable taxes (CGT withholding, advance tax, sales tax on services) and how they are applied",
        "Custody, account maintenance, physical settlement or transfer fees, if any",
        "The effective date of the schedule, so it can be published with an accurate date",
      ],
    },
  },
];

/** Lookup by slug, for the route components. */
export function getLegalPage(slug: string): LegalPage | undefined {
  return LEGAL_PAGES.find((p) => p.slug === slug);
}
