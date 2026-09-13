import { expect, test } from "./fixtures";
import { categorize } from "../../src/lib/announcementCategory";

/*
 * Plural AGMs in the whole-word filing-type match.
 *
 * Its own file, so announcements-category-v2.spec.ts — the segment and
 * singular AGM/EGM/CBS cases this change must not disturb — stays exactly
 * as it shipped. All three titles are verbatim PSX filings that v1 tagged
 * Meetings and the first whole-word version (fbd0344) dropped to Other.
 */
test.beforeEach(() => {
  test.skip(test.info().project.name !== "desktop", "Pure-function tests; run once");
});

test("the three plural-AGM filings tag as meetings again", () => {
  /** [title, symbol, filed] — verbatim from PSX's own search results. */
  const PLURAL_AGMS: Array<[string, string, string]> = [
    [
      "26TH, 27TH AND 28TH AGMS FOR THE FY 2016, 2017 AND 2018 RESPECTIVELY OF SPLC HELD ON MAY 16, 2019 AT KARACHI",
      "SPLC",
      "May 17, 2019",
    ],
    [
      "AGMs of K-Electric Limited for the financial years ended 30 June 2017 and 2018",
      "KEL",
      "Mar 7, 2019",
    ],
    ["SECP approval for holding AGMs for 2016 and 2017", "MOON", "Feb 21, 2018"],
  ];
  for (const [title, symbol, filed] of PLURAL_AGMS) {
    expect(categorize(title), `${symbol} (${filed}): ${title}`).toBe("meetings");
  }
});

test("the plural allowance does not reopen the segment false positive", () => {
  // "segments": the "egm" follows a letter, so the unchanged leading
  // boundary still rejects it even though an "s" now may follow.
  expect(categorize("Material Information- Expansion in Retail Segment")).toBe("material");
  expect(
    categorize("Request for Removal from Non-Compliance Segment Amendment of Object Clause"),
  ).toBe("other");
});
