import * as Sentry from "@sentry/node";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import type {
  CompanyDetailResponse,
  CompanyFinancialRow,
  CompanyFinancialTable,
  CompanyFootnote,
  CompanyFundamentals,
  CompanyPerson,
  CompanyProfile,
} from "../../src/types/listed-company";

/**
 * GET /api/company/detail?symbol=<SYM>
 *
 * The Fundamentals and Profile blocks on /market-watch/:symbol, from
 * ONE fetch of PSX's Data Portal page for that symbol. Both sections
 * come off the same HTML document, so fetching it twice would double
 * the load on PSX for nothing.
 *
 * This is the twelfth and last Vercel function this project can have
 * on Hobby. Anything further has to merge into an existing one.
 *
 * WHAT IS DELIBERATELY NOT TAKEN FROM THIS PAGE. It also publishes a
 * day range, a 52-week range, announcements and payouts. This page
 * already has all four from sources it trusts more, and PSX's own
 * 52-week low for PRWM sat above 191 of the year's 220 closes in
 * PSX's own EOD archive (checked 2026-09-21) — so a second, conflicting
 * copy of a figure the page already gets right is worth nothing. The
 * Payouts and Financial Reports sections here are filled in by the
 * page's own JavaScript and are empty in the server HTML anyway.
 *
 * URL RULES, each verified against the live page:
 *   - The path is case-SENSITIVE: /company/hbl answers 500. Symbols
 *     are upper-cased here before the fetch, never passed through.
 *   - An unknown symbol answers HTTP 500 — not 404 — with the title
 *     "Not Found - Pakistan Stock Exchange (PSX)". Not-found is
 *     therefore detected by TITLE; trusting the status would turn
 *     every typo into a false outage.
 *   - An ETF symbol 302s to /etf/<SYM>, a different page with neither
 *     section on it. The redirect is read rather than followed, and
 *     answers kind: "etf".
 *
 * WHY NODE (not Edge): a deployed probe (2026-09-21) got 200 with full
 * content from both runtimes twice each, so either would work. Node
 * matches the other PSX HTML scrapers in this project and keeps the
 * regex parsing identical to them.
 *
 * The adapter is inlined — no relative runtime imports between
 * compiled functions (a known FUNCTION_INVOCATION_FAILED cause on
 * Vercel with "type": "module"). The type-only imports above are
 * erased at compile time and safe.
 *
 * RUNTIME: Node.
 */

/*
 * Sentry, initialized inline rather than from a shared api/ module,
 * for the no-relative-runtime-imports reason above. No SENTRY_DSN →
 * never initialized → silent no-op.
 */
if (process.env.SENTRY_DSN) Sentry.init({ dsn: process.env.SENTRY_DSN });

const PSX_ORIGIN = "https://dps.psx.com.pk";

/** PSX's title for a symbol it does not list. */
const NOT_FOUND_TITLE = "Not Found";

/**
 * Symbols are letters, digits and the few punctuation marks PSX uses
 * in class listings. Anything else never reaches PSX: a malformed
 * symbol is this API's 400, not a 500 from someone else's server.
 */
const SYMBOL_PATTERN = /^[A-Z0-9][A-Z0-9.&-]{0,19}$/;

/**
 * SIX HOURS, against 15 minutes for announcements and 75 seconds for
 * quotes.
 *
 * Nothing in this payload is live. Financials and ratios change when a
 * company reports, at most quarterly; the profile changes when a
 * company changes auditor or registrar, which is rarer still. P/E and
 * market cap do move with the price — they are the only figures here
 * that do — but this block is reference data sitting underneath a live
 * quote and a live day range that are fetched separately and already
 * carry their own short windows. Six hours refreshes fundamentals
 * about four times a trading day while capping load on PSX at ~4
 * fetches per symbol per day per edge region.
 */
const CACHE_SECONDS = 21_600;

/** A day of serving the last good read while PSX is unreachable. */
const STALE_SECONDS = 86_400;

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

/**
 * Tags out, entities decoded, whitespace collapsed.
 *
 * Each tag becomes a space so adjacent words never fuse, which leaves
 * a space before any punctuation that followed a tag — PSX bolds the
 * words "Capital Stake" mid-sentence, so the attribution came out as
 * "Capital Stake ." A space before a closing punctuation mark is an
 * artefact of this stripping, never something the page displays, so it
 * is removed again here.
 */
function text(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .replace(/\s+([.,;:!?])/g, "$1")
    .trim();
}

/**
 * One `<div class="section …" id="…">` block, up to the next one.
 *
 * The page is a flat run of sibling sections, so "until the next
 * section opens" is the whole of this one. Slicing by id keeps a
 * label search inside its own section: "Free Float" appears in the
 * equity block and "Sales" in two different tables.
 */
function sectionHtml(html: string, id: string): string | null {
  const start = html.search(new RegExp(`<div class="section[^"]*"[^>]*id="${id}"`));
  if (start < 0) return null;
  const rest = html.slice(start);
  const next = rest.slice(1).search(/<div class="section[^"]*"[^>]*id="/);
  return next < 0 ? rest : rest.slice(0, next + 1);
}

/** The `stats_label` → `stats_value` pairs in a section, in order. */
function statsPairs(section: string): [string, string][] {
  return [
    ...section.matchAll(
      /stats_label"[^>]*>([\s\S]*?)<\/div>\s*<div class="stats_value[^"]*">([\s\S]*?)<\/div>/g,
    ),
  ].map((m) => [text(m[1]), text(m[2])] as [string, string]);
}

/**
 * A trailing run of `*` on a label, split from the label itself.
 *
 * PSX marks P/E as "P/E Ratio (TTM) **", and the markers are not
 * decoration: "**" says the figure is built on unconsolidated
 * financials. Dropping it would change what the number claims.
 */
function splitMarkers(label: string): { label: string; markers: string[] } {
  const match = label.match(/^(.*?)\s*([*^]+)$/);
  if (!match) return { label: label.trim(), markers: [] };
  // "**" and "*" are distinct markers; "^" is the price-chart footnote.
  const markers = match[2].includes("**") ? ["**"] : [match[2]];
  return { label: match[1].trim(), markers };
}

/** "N/A" (PSX's own) and blanks both mean "no figure", never zero. */
function figure(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || /^n\/?a$/i.test(trimmed) || trimmed === "-") return null;
  return trimmed;
}

/**
 * A `<table>` → its column headings and rows, read BY LABEL.
 *
 * The first header cell is the empty corner above the row labels and
 * is dropped, so `periods[i]` lines up with `values[i]`.
 *
 * A row whose cells are ALL empty is dropped entirely: PSX ships
 * "Sales" with four blank cells for CJPL, and a row of dashes under a
 * heading implies a figure exists and is unreadable, when the truth is
 * that PSX published none. A row with SOME blanks is kept, because
 * which periods are missing is itself information.
 */
function parseTable(tableHtml: string): CompanyFinancialTable | null {
  const headers = [...tableHtml.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map((m) =>
    text(m[1]),
  );
  const periods = headers.slice(1).filter((h) => h.length > 0);
  if (!periods.length) return null;

  const rows: CompanyFinancialRow[] = [];
  for (const match of tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const cells = [...match[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) =>
      text(c[1]),
    );
    if (cells.length < 2) continue;
    const label = cells[0];
    if (!label) continue;
    const values = periods.map((_, i) => figure(cells[i + 1]));
    if (values.every((v) => v === null)) continue;
    rows.push({ label, values });
  }
  return rows.length ? { periods, rows } : null;
}

/** The first `<table>` inside a fragment, if any. */
function firstTable(fragment: string): string | null {
  const match = fragment.match(/<table[\s\S]*?<\/table>/);
  return match ? match[0] : null;
}

/** One named tab panel of the financials block. */
function tabPanel(section: string, name: string): string | null {
  const match = section.match(
    new RegExp(`<div class="tabs__panel"[^>]*data-name="${name}"[^>]*>([\\s\\S]*?)(?=<div class="tabs__panel"|$)`),
  );
  return match ? match[1] : null;
}

/**
 * The profile block.
 *
 * Read by HEADING — BUSINESS DESCRIPTION, KEY PEOPLE, ADDRESS… —
 * because PSX packs several headings into one column div and drops the
 * ones it has nothing for. ANLNV, a non-voting share class, publishes
 * the headings with every value blank; that comes back `isEmpty` so
 * the page can say the profile is not published rather than render an
 * empty card that looks broken.
 */
function parseProfile(html: string): CompanyProfile | null {
  const section = sectionHtml(html, "profile");
  if (!section) return null;

  const fields = new Map<string, string>();
  let people: CompanyPerson[] = [];

  const heads = [...section.matchAll(/<div class="item__head">([\s\S]*?)<\/div>/g)];
  for (const [i, head] of heads.entries()) {
    const label = text(head[1]).toUpperCase();
    const from = head.index! + head[0].length;
    const to = i + 1 < heads.length ? heads[i + 1].index! : section.length;
    const body = section.slice(from, to);

    if (label === "KEY PEOPLE") {
      people = [...body.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)]
        .map((row) => [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => text(c[1])))
        .filter((cells) => cells.length >= 2 && cells[0])
        .map((cells) => ({ name: cells[0], role: cells[1] }));
      continue;
    }
    const value = text(body);
    if (value) fields.set(label, value);
  }

  const profile: CompanyProfile = {
    description: fields.get("BUSINESS DESCRIPTION"),
    keyPeople: people,
    address: fields.get("ADDRESS"),
    website: fields.get("WEBSITE"),
    registrar: fields.get("REGISTRAR"),
    auditor: fields.get("AUDITOR"),
    fiscalYearEnd: fields.get("FISCAL YEAR END"),
    isEmpty: false,
  };
  profile.isEmpty =
    !people.length &&
    !profile.description &&
    !profile.address &&
    !profile.website &&
    !profile.registrar &&
    !profile.auditor &&
    !profile.fiscalYearEnd;
  return profile;
}

/**
 * The footnote legend PSX prints under the quote, e.g.
 * "** Based on unconsolidated financials".
 *
 * Parsed rather than hard-coded: if PSX restates what a marker means,
 * the page should say PSX's sentence, not one written here months ago.
 */
function parseFootnotes(html: string): CompanyFootnote[] {
  const found: CompanyFootnote[] = [];
  for (const match of html.matchAll(/(\*{1,2}|\^)\s?([A-Z][^<*^]{10,120})/g)) {
    const meaning = text(match[2]).replace(/\s+$/, "");
    if (!/^(Based on|Returns not|The historical)/.test(meaning)) continue;
    if (found.some((f) => f.marker === match[1])) continue;
    found.push({ marker: match[1], meaning });
  }
  return found;
}

/**
 * Capital Stake's notice, read from the page it belongs to.
 *
 * The page ends it with "See the Capital Stake Terms of Use.", which
 * is the label of a modal this site cannot open; that sentence is
 * dropped and the rest is passed through verbatim. It covers the
 * financials and ratios ONLY — the profile and equity figures are
 * PSX's own — so the UI scopes it to those tables.
 */
function parseAttribution(html: string): string | null {
  // Located by its own block, then read from the `text` div inside it.
  // The block nests a logo div, so this cannot be one lazy match.
  const start = html.indexOf('<div class="poweredBy">');
  if (start < 0) return null;
  const body = html.slice(start).match(/<div class="text">([\s\S]*?)<\/div>/);
  if (!body) return null;
  const full = text(body[1]);
  return full.replace(/\s*See the\s+Capital Stake Terms of Use\.?\s*$/i, "").trim() || null;
}

/** The equity and quote figures, plus the three tables. */
function parseFundamentals(html: string): CompanyFundamentals {
  const quote = sectionHtml(html, "quote");
  let peRatioTtm: string | null = null;
  let peFootnotes: string[] = [];
  if (quote) {
    for (const [rawLabel, value] of statsPairs(quote)) {
      const { label, markers } = splitMarkers(rawLabel);
      if (/^P\/E Ratio/i.test(label)) {
        peRatioTtm = figure(value);
        // A footnote explains a figure. PSX prints the "**" even where
        // it prints "N/A" for the P/E itself; carrying the marker over
        // to a figure that does not exist would annotate nothing.
        peFootnotes = peRatioTtm ? markers : [];
        break;
      }
    }
  }

  /*
   * PSX prints "Free Float" TWICE in the equity block: the share count
   * first, then the percentage. Telling them apart by the trailing "%"
   * rather than by position means a reordering upstream cannot swap a
   * share count into a percentage field.
   */
  const equity = sectionHtml(html, "equity");
  let marketCapThousands: string | null = null;
  let shares: string | null = null;
  let freeFloatShares: string | null = null;
  let freeFloatPercent: string | null = null;
  if (equity) {
    for (const [label, value] of statsPairs(equity)) {
      const clean = figure(value);
      if (/^Market Cap/i.test(label)) marketCapThousands ??= clean;
      else if (/^Shares$/i.test(label)) shares ??= clean;
      else if (/^Free Float/i.test(label)) {
        if (clean?.endsWith("%")) freeFloatPercent ??= clean;
        else freeFloatShares ??= clean;
      }
    }
  }

  const financials = sectionHtml(html, "financials");
  const annualPanel = financials ? tabPanel(financials, "Annual") : null;
  const quarterlyPanel = financials ? tabPanel(financials, "Quarterly") : null;
  const annualTable = annualPanel ? firstTable(annualPanel) : null;
  const quarterlyTable = quarterlyPanel ? firstTable(quarterlyPanel) : null;

  const unitsMatch = financials?.match(/All numbers in [^<]+/);
  const ratiosSection = sectionHtml(html, "ratios");
  const ratiosTable = ratiosSection ? firstTable(ratiosSection) : null;

  return {
    peRatioTtm,
    peFootnotes,
    marketCapThousands,
    shares,
    freeFloatShares,
    freeFloatPercent,
    unitsNote: unitsMatch ? text(unitsMatch[0]) : null,
    annual: annualTable ? parseTable(annualTable) : null,
    quarterly: quarterlyTable ? parseTable(quarterlyTable) : null,
    ratios: ratiosTable ? parseTable(ratiosTable) : null,
  };
}

/** Everything this endpoint serves, from one page of HTML. */
function parseCompanyPage(symbol: string, html: string): CompanyDetailResponse {
  const fundamentals = parseFundamentals(html);
  /*
   * Only the legends for markers that actually reach the page. PSX's
   * legend also explains "*" (returns not adjusted for payouts) and
   * "^" (prices adjusted for splits), which annotate the return and
   * chart figures this endpoint deliberately does not take — and a
   * footnote with nothing to point at is just clutter a reader has to
   * rule out.
   */
  const used = new Set(fundamentals.peFootnotes);
  return {
    symbol,
    kind: "company",
    profile: parseProfile(html),
    fundamentals,
    footnotes: parseFootnotes(html).filter((f) => used.has(f.marker)),
    attribution: parseAttribution(html),
    asOf: new Date().toISOString(),
    source: "psx",
  };
}

class NotFoundError extends Error {}

/**
 * One fetch of the company page, or the ETF answer.
 *
 * The redirect is read, not followed: an ETF's own page is a different
 * shape with neither section on it, and following it would mean
 * parsing a document this code has no contract for.
 */
async function fetchCompany(symbol: string): Promise<CompanyDetailResponse> {
  const response = await fetch(`${PSX_ORIGIN}/company/${symbol}`, {
    headers: {
      Accept: "text/html",
      "User-Agent": "azee-trade-web/1.0 (company detail)",
    },
    redirect: "manual",
    signal: AbortSignal.timeout(12_000),
  });

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location") ?? "";
    if (/\/etf\//i.test(location)) {
      return {
        symbol,
        kind: "etf",
        profile: null,
        fundamentals: null,
        footnotes: [],
        attribution: null,
        asOf: new Date().toISOString(),
        source: "psx",
      };
    }
    throw new Error(`PSX company page redirected to ${location || "(no location)"}`);
  }

  const html = await response.text();
  const title = text(html.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "");

  /*
   * TITLE, NOT STATUS. PSX answers an unknown symbol with HTTP 500 and
   * this title, so a status check alone would report every mistyped
   * symbol as a PSX outage — and would retry it on the next request.
   */
  if (title.startsWith(NOT_FOUND_TITLE)) throw new NotFoundError(symbol);
  if (!response.ok) {
    throw new Error(`PSX company page responded ${response.status}`);
  }
  return parseCompanyPage(symbol, html);
}

/**
 * The last good read per symbol, so a PSX outage serves yesterday's
 * fundamentals clearly labelled rather than an empty section. Warm
 * only for the lifetime of one function instance, which is why the
 * `stale` flag exists rather than any promise about it.
 */
const lastGood = new Map<string, CompanyDetailResponse>();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const raw = String(req.query.symbol ?? "").trim();
  const symbol = raw.toUpperCase();

  if (!symbol || !SYMBOL_PATTERN.test(symbol)) {
    res.setHeader("Cache-Control", "no-store");
    res.status(400).json({
      error: `"${raw}" is not a PSX symbol`,
    });
    return;
  }

  try {
    const data = await fetchCompany(symbol);
    lastGood.set(symbol, data);
    res.setHeader(
      "Cache-Control",
      `s-maxage=${CACHE_SECONDS}, stale-while-revalidate=${STALE_SECONDS}`,
    );
    res.status(200).json(data);
  } catch (error) {
    if (error instanceof NotFoundError) {
      // A symbol PSX does not list is a settled answer, not an outage,
      // so it is cacheable and says so plainly.
      res.setHeader("Cache-Control", `s-maxage=${CACHE_SECONDS}`);
      res.status(404).json({
        error: `PSX publishes no company page for ${symbol}`,
      });
      return;
    }
    console.error(`PSX company page fetch failed for ${symbol}:`, error);
    const cached = lastGood.get(symbol);
    if (cached) {
      res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=86400");
      res.status(200).json({ ...cached, stale: true, source: "cache" });
      return;
    }
    res.setHeader("Cache-Control", "no-store");
    res.status(503).json({
      error: `PSX company details for ${symbol} are temporarily unavailable`,
    });
  }
}

export { fetchCompany, parseCompanyPage };
