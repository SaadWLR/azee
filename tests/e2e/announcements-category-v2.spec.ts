import { expect, test } from "./fixtures";
import { categorize, type Category } from "../../src/lib/announcementCategory";

/*
 * Filing-type rule table, version 2.
 *
 * Its own file, so the Milestone 3 spec (announcements-category.spec.ts)
 * stays exactly as it shipped. Every title here is a real, verbatim PSX
 * title — from the live batch read on Sep 12 2026, or from PSX's own
 * search for the tokens involved — never an invented one.
 */
test.beforeEach(() => {
  test.skip(test.info().project.name !== "desktop", "Pure-function tests; run once");
});

test.describe("v2: agm / egm / cbs match only as whole words", () => {
  test("the two segment titles from the read-through no longer land in Meetings", () => {
    const bbfl = "Material Information- Expansion in Retail Segment";
    const bapl = "Request for Removal from Non-Compliance Segment Amendment of Object Clause";

    // v1 tagged both "meetings" — "egm" inside "segment".
    expect(categorize(bbfl)).not.toBe("meetings");
    expect(categorize(bapl)).not.toBe("meetings");

    // Where they belong once that false match is gone.
    expect(categorize(bbfl)).toBe("material");
    expect(categorize(bapl)).toBe("other");
  });

  test("no PSX filing mentioning a segment lands in Meetings", () => {
    // All 17 filings PSX's search returns for "segment" (Sep 13 2026).
    const SEGMENT_TITLES = [
      "Material Information- Expansion in Retail Segment",
      "Material Information - Discontinuance of Cotton Segment REVOKED",
      "HWQS | Haseeb Waqas Sugar Mills Limited - Revival of Companies Quoted in Non-Compliant Segment.",
      "Request for Removal from Non-Compliance Segment Amendment of Object Clause",
      "DSML | Dar-es-Salaam Textile Mills Limited - Request for Removal of the Company from Defaulters Segment Following Successful Amalgamation",
      "Successsful CoD of feedstock plant for non-ferrous segment",
      "Third Rejoinder to Placement of SERF from Defaulter Segment - G3 Technologies Limited",
      "Material Information Rejoinder to the Placement of SERF in Defaulters Segment - SERVICE FABRICS LIMITED",
      "Non Production Days in Automobile Segment",
      "Placement of Summit Bank Limited in the Defaulter's Segment",
      "PPlacement of Dost Steels Limited in the Defaulters' Segment",
      "AGSML | Abdullah Shah Ghazi Sugar Mills Limited - Shifting of the name of Company from Defaulters Segment to Normal Counter and Resumption of Trading in the shares of the Company",
      "Hon'able High Court of Sindh Ad-interim injunction granted in favour of TRIBL against Placement in the Defaulter's Segment",
      "200% Capacity Enhancement in Existing BOPET Film Producing Segment",
      "Material Information regarding Placement of Name in Default Segment",
      "Court Order for Removal of WTL from Defaulters' Segment",
      "AGSML | Abdullah Shah Ghazi Sugar Mills Limited - Placement of Company In The Defaulters Segment & Suspension of Trading in Its Shares Under Clause 5.11.1 (B) of PSX Regulations",
    ];
    for (const title of SEGMENT_TITLES) {
      expect(categorize(title), title).not.toBe("meetings");
    }
  });

  test("genuine AGM / EGM / CBS titles still land correctly", () => {
    /** [title, symbol, expected] — the true positives the fix must keep. */
    const TRUE_POSITIVES: Array<[string, string, Category]> = [
      ["Postal Ballot Paper for Special Business at EGM 2025", "OGDC", "meetings"],
      ["PUBLICATION OF NOTICE OF AGM IN NEWS PAPERS", "BWHL", "meetings"],
      ["Video Recording of CBS 2026", "UVIC", "briefings"],
    ];
    for (const [title, symbol, expected] of TRUE_POSITIVES) {
      expect(categorize(title), `${symbol}: ${title}`).toBe(expected);
    }
  });

  test("the whole-word boundary holds at every edge a real title uses", () => {
    const BOUNDARIES: Array<[string, string, Category, string]> = [
      ["AGM - Resolution Passed by the Shareholders", "SASML", "meetings", "start of title"],
      ["Approval of Directors Elected at the 31st AGM", "AGIC", "meetings", "end of title"],
      ["EGM", "ARPL", "meetings", "the whole title"],
      [
        "EGM-26, Extracts of the Resolutions Passed in the Extra-Ordinary General Meeting of the Company Held On 29-Jun-2026",
        "EMCO",
        "meetings",
        "followed by a hyphen — and 'Extra-Ordinary' misses the long keyword, so only EGM can tag it",
      ],
      ["CBS Presentation For The Nine Months & Quarter Ended March 31, 2026", "INDU", "briefings", "start of title"],
      ["Second Corporate Briefing (CBS) - 2026", "FFC", "briefings", "in parentheses, with no 'session'"],
      ["Corporate Briefing Cession (CBS)", "CSIL", "briefings", "PSX's own typo leaves only CBS to match"],
    ];
    for (const [title, symbol, expected, why] of BOUNDARIES) {
      expect(categorize(title), `${symbol} (${why}): ${title}`).toBe(expected);
    }
  });
});

test.describe("v2: the five added keywords, each on its real source title", () => {
  /** [title, symbol, expected, keyword] — all verbatim, all tagged Other by v1. */
  const ADDED: Array<[string, string, Category, string]> = [
    ["DECLARATION OF RIGHT ISSUE", "CENI", "actions", "right issue"],
    ["Credit Of Bonus Share Certificates", "HICL", "actions", "bonus share"],
    [
      "Public Announcement of Intention to Acquire at least 30% (33,177,164 shares) of Nimir Industrial Chemicals Limited",
      "CHCC",
      "actions",
      "intention to acquire",
    ],
    ["209th BOD meeting of Millat Tractors Limited", "MTL", "meetings", "bod meeting"],
    ["Board of Directors Meeting / Closed Period", "NCL", "meetings", "board of directors meeting"],
    [
      "ABL | Allied Bank Limited UNUSUAL MOVEMENT IN VOLUME OF THE SHARES OF ALLIED BANK LIMITED (ABL)",
      "ABL",
      "material",
      "unusual movement",
    ],
  ];

  for (const [title, symbol, expected, keyword] of ADDED) {
    test(`"${keyword}" → ${expected} (${symbol})`, () => {
      expect(categorize(title)).toBe(expected);
    });
  }
});

test("v2 leaves the accepted limits of a title-only table exactly as they were", () => {
  /*
   * Deliberately NOT fixed — pinned so a later edit changes them on
   * purpose rather than by accident. All real titles from the batch.
   */
  const UNCHANGED: Array<[string, string, Category, string]> = [
    [
      "INTIMATION OF RELAXATION FROM CONSOLIDATION OF FINANCIAL STATMENTS OF FAZAL CLOTH MILLS LTD (HOLDING COMPANY) WITH FAZAL GAS DISTRIBUTION COMPANY LTD (SUBSIDIARY) UNDER SECTION 228(7) OF THE COMPANIES ACT, 2017",
      "FZCM",
      "other",
      "PSX's 'STATMENTS' typo is not matched",
    ],
    [
      "ALHAMRA DAILY DIVIDEND FUND (ALHDDF) Daily Dividend Distribution for 10-SEP-26",
      "MCBIM-FUNDS",
      "actions",
      "daily fund distributions stay in Actions",
    ],
    ["DISCLOSURE UNDER TAKE OVER REGULATIONS", "NICL", "actions", "take over regulations stay in Actions"],
    ["Compliance with Clause 5.6.4 (b)", "JLICL", "insiders", "a bare 5.6.4 stays Insiders"],
    [
      "DECISIONS OF THE BOARD MEETING - GHANI GLOBAL GLASS LIMITED",
      "GGGL",
      "meetings",
      "decisions of the board meeting stay Meetings",
    ],
  ];
  for (const [title, symbol, expected, why] of UNCHANGED) {
    expect(categorize(title), `${symbol} (${why})`).toBe(expected);
  }
});
