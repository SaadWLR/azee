import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { useAnnouncements } from "../hooks/useCalendar";
import { useAllMarketQuotes } from "../hooks/useMarketData";
import { usePageMeta } from "../hooks/usePageMeta";
import {
  CATEGORY_TABS,
  isCategory,
  type Category,
} from "../lib/announcementCategory";
import {
  applyCategory,
  applyMarketFilters,
  countByCategory,
} from "../lib/announcementFilters";
import type { CompanyAnnouncement } from "../types/announcements";
import type { StockQuote } from "../types";

/*
 * /announcements — company disclosures filed with the PSX.
 *
 * Every row is PSX's own record: the filing's verbatim title, the
 * company that filed it, PSX's timestamp, and a link to PSX's original
 * document. Nothing is summarized, scored, or otherwise synthesized —
 * an announcement is a regulatory disclosure, and paraphrasing one
 * would put words in a listed company's mouth.
 *
 * Reuses the Market Watch / Corporate Calendar / ETFs liquid-glass
 * table language — no new visual vocabulary.
 *
 * TWO KINDS OF FILTER, and the difference is visible to the reader.
 *
 * Search, date range and symbol are PSX's OWN fields, so PSX does the
 * narrowing and the rows and the "of N" total describe the same query.
 * Symbol in particular is exact and complete: probed live, symbol=OGDC
 * reports 729 filings and walks back to 2005.
 *
 * Sector, Shariah-compliance and filing type are NOT PSX fields. They
 * are applied here, over ONE batch of filings at a time: sector and
 * Shariah against Market Watch data, filing type against each title.
 * That is a real limitation, so the page says so whenever any of them
 * is on rather than implying a complete history.
 */

const PAGE_SIZE = 50;

/*
 * The batch size used when filtering client-side. 100 is PSX's own cap
 * per request (larger counts are silently clamped), so it is the widest
 * window a single request can look through. Sector, Shariah and filing
 * type all use the same batch, so moving between them never changes
 * the search depth underneath the reader.
 */
const CLIENT_BATCH = 100;

/*
 * Long enough that ordinary typing commits once rather than per
 * keystroke, short enough to feel immediate. Each commit is a URL
 * change and a PSX fetch, so this is the difference between one
 * request and one per character.
 */
const SEARCH_DEBOUNCE_MS = 400;

const MAX_SYMBOL_SUGGESTIONS = 8;

const COLUMNS = ["Date", "Time", "Symbol", "Company", "Announcement"];

/** The exact input treatment Market Watch uses — not a new one. */
const INPUT_CLASS =
  "liquid-glass w-full rounded-full px-4 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400/40";

/** Same treatment, greyed when a symbol has taken these out of play. */
const DISABLED_CLASS = "disabled:cursor-not-allowed disabled:opacity-40";

/** Market Watch's preset pills — the same selected/unselected pair. */
function pillClass(selected: boolean): string {
  return `rounded-full px-4 py-2 text-xs font-semibold transition-all duration-300 ${
    selected ? "bg-white text-black" : "liquid-glass text-white hover:bg-white/15"
  }`;
}

export function AnnouncementsPage() {
  usePageMeta(
    "PSX Company Announcements — Live Corporate Disclosures | AZEE Trade",
    "Live company announcements filed with the Pakistan Stock Exchange — board meetings, financial results, dividend notices and other corporate disclosures, each linking to the original PSX document.",
  );

  /*
   * Page and filters both live in the URL so a filtered view can be
   * linked and back/forward works — same addressable-state convention
   * as ?page= already used here. 1-based for humans, 0-based offset for
   * PSX.
   */
  const [searchParams, setSearchParams] = useSearchParams();
  const pageParam = Number(searchParams.get("page"));
  const page = Number.isFinite(pageParam) && pageParam >= 1 ? Math.trunc(pageParam) : 1;

  const q = (searchParams.get("q") ?? "").trim();
  const fromParam = searchParams.get("from") ?? "";
  const toParam = searchParams.get("to") ?? "";
  const symbolParam = (searchParams.get("symbol") ?? "").trim().toUpperCase();

  /*
   * A symbol overrides sector and Shariah-compliance rather than
   * combining with them: one company has one sector and one index
   * membership, so narrowing a single company by its own sector filters
   * nothing. The controls are disabled to say so, and the params are
   * dropped from the URL when a symbol is chosen.
   *
   * Filing type is the exception, and deliberately so: one company still
   * files many different kinds of disclosure, so it composes with a
   * symbol — and with everything else — and is never disabled.
   */
  const sector = symbolParam ? "" : (searchParams.get("sector") ?? "");
  const shariah = symbolParam ? false : searchParams.get("shariah") === "1";
  const categoryParam = searchParams.get("category") ?? "";
  const category: Category | null = isCategory(categoryParam) ? categoryParam : null;

  const clientFiltering = Boolean(sector) || shariah || category !== null;

  /*
   * PSX ignores a one-sided range outright and answers with the whole
   * corpus (verified against the live endpoint), so a half-filled range
   * is never sent. The user is told why instead of watching a filter do
   * nothing.
   */
  const rangeComplete = Boolean(fromParam) && Boolean(toParam);
  const rangeIncomplete = Boolean(fromParam) !== Boolean(toParam);
  const filtersActive =
    Boolean(q) ||
    Boolean(fromParam) ||
    Boolean(toParam) ||
    Boolean(symbolParam) ||
    clientFiltering;

  // A client-side filter reads a wider batch, since it keeps only part of it.
  const fetchCount = clientFiltering ? CLIENT_BATCH : PAGE_SIZE;
  const offset = (page - 1) * fetchCount;

  const { data, loading, error } = useAnnouncements(fetchCount, offset, {
    q: q || undefined,
    dateFrom: rangeComplete ? fromParam : undefined,
    dateTo: rangeComplete ? toParam : undefined,
    symbol: symbolParam || undefined,
  });

  /*
   * The same hook, and the same /api/market/watch URL, Market Watch and
   * the ticker already use. apiGet coalesces concurrent same-URL GETs
   * and briefly caches the result, so this adds no request of its own —
   * it is where the sector and KMI facts come from, never a second
   * source of truth.
   */
  const { data: quotes } = useAllMarketQuotes();

  const bySymbol = useMemo(() => {
    const map = new Map<string, StockQuote>();
    for (const quote of quotes ?? []) map.set(quote.symbol, quote);
    return map;
  }, [quotes]);

  /*
   * Sector options come from the sectors actually present in the live
   * feed, never a hardcoded list — if PSX renames or adds one, this
   * follows without an edit.
   */
  const sectors = useMemo(() => {
    const names = new Set<string>();
    for (const quote of quotes ?? []) if (quote.sector) names.add(quote.sector);
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [quotes]);

  const batch = data?.announcements;
  const batchSize = batch?.length ?? 0;

  /*
   * Two independent stages. Sector/Shariah consult Market Watch, and
   * only when one of them is on. Filing type reads the title alone and
   * runs over whatever the first stage kept — it is never gated on a
   * Market Watch lookup, so a filing from a symbol absent from that feed
   * (a delisted company, or a fund manager such as MCBIM-FUNDS) is still
   * tagged and still shown under its tab.
   */
  const working = useMemo(
    () => applyMarketFilters(batch ?? [], { sector, shariah }, bySymbol),
    [batch, sector, shariah, bySymbol],
  );

  /*
   * Tab counts describe the working set BEFORE filing type narrows it,
   * so every tab shows how the current batch splits — not just the one
   * selected.
   */
  const tabCounts = useMemo(() => countByCategory(working), [working]);

  const rows = useMemo(() => applyCategory(working, category), [working, category]);

  const total = data?.totalAvailable ?? null;
  const stale = data?.stale;

  /* ── Search box: keystrokes local, committed value in the URL ──── */

  const [searchInput, setSearchInput] = useState(q);
  const committedQ = useRef(q);

  useEffect(() => {
    if (committedQ.current !== q) {
      committedQ.current = q;
      setSearchInput(q);
    }
  }, [q]);

  useEffect(() => {
    if (searchInput.trim() === q) return;
    const id = setTimeout(() => {
      const next = searchInput.trim();
      committedQ.current = next;
      setSearchParams((current) => {
        const params = new URLSearchParams(current);
        if (next) params.set("q", next);
        else params.delete("q");
        // Any filter change returns to the first page: page 7 of the
        // old result set means nothing in the new one.
        params.delete("page");
        return params;
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [searchInput, q, setSearchParams]);

  /* ── Symbol autocomplete over the Market Watch directory ───────── */

  const [symbolInput, setSymbolInput] = useState(symbolParam);
  const committedSymbol = useRef(symbolParam);
  const [symbolOpen, setSymbolOpen] = useState(false);

  useEffect(() => {
    if (committedSymbol.current !== symbolParam) {
      committedSymbol.current = symbolParam;
      setSymbolInput(symbolParam);
    }
  }, [symbolParam]);

  const suggestions = useMemo(() => {
    const term = symbolInput.trim().toUpperCase();
    if (!term || term === symbolParam) return [];
    return (quotes ?? [])
      .filter(
        (quote) =>
          quote.symbol.includes(term) ||
          (quote.name ?? "").toUpperCase().includes(term),
      )
      .slice(0, MAX_SYMBOL_SUGGESTIONS);
  }, [symbolInput, symbolParam, quotes]);

  function applySymbol(next: string) {
    committedSymbol.current = next;
    setSymbolInput(next);
    setSymbolOpen(false);
    setSearchParams((current) => {
      const params = new URLSearchParams(current);
      if (next) {
        params.set("symbol", next);
        // Sector and Shariah go; filing type stays — it still applies.
        params.delete("sector");
        params.delete("shariah");
      } else {
        params.delete("symbol");
      }
      params.delete("page");
      return params;
    });
  }

  function setParam(key: string, value: string) {
    setSearchParams((current) => {
      const params = new URLSearchParams(current);
      if (value) params.set(key, value);
      else params.delete(key);
      params.delete("page");
      return params;
    });
  }

  function clearFilters() {
    committedQ.current = "";
    committedSymbol.current = "";
    setSearchInput("");
    setSymbolInput("");
    setSymbolOpen(false);
    setSearchParams((current) => {
      const params = new URLSearchParams(current);
      for (const key of [
        "q",
        "from",
        "to",
        "symbol",
        "sector",
        "shariah",
        "category",
        "page",
      ]) {
        params.delete(key);
      }
      return params;
    });
  }

  /* ── Pager ─────────────────────────────────────────────────────── */

  const from = offset + 1;
  const to = offset + batchSize;
  const hasPrev = page > 1;
  /*
   * Next walks PSX's own pagination in both modes. Under a client-side
   * filter it advances by the batch, not by the number of matches — a
   * batch may legitimately hold none, and chaining requests to backfill
   * a full page would turn one click into an unbounded number of
   * requests against PSX.
   */
  const hasNext = total !== null ? to < total : batchSize === fetchCount;

  function goTo(next: number) {
    setSearchParams((current) => {
      const params = new URLSearchParams(current);
      if (next <= 1) params.delete("page");
      else params.set("page", String(next));
      return params;
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /*
   * Zero rows is a real answer, not an outage, and it gets its own state
   * so it can never borrow the "temporarily unavailable" copy. Three
   * different empties are told apart so the copy can say which one it
   * is: PSX returned nothing at all; PSX returned a batch but sector or
   * Shariah kept none of it; or rows survived those and simply none
   * carries the selected filing type.
   */
  const noResults = Boolean(batch) && rows.length === 0;
  const emptyForCategory =
    noResults && category !== null && working.length > 0;
  const emptyBatchFiltered =
    noResults && !emptyForCategory && clientFiltering && batchSize > 0;
  const categoryLabel =
    CATEGORY_TABS.find((tab) => tab.id === category)?.label ?? "";

  const controlsLocked = Boolean(symbolParam);

  return (
    <main className="min-h-screen text-white">
      <Navbar />

      <section className="section-tint-a relative px-4 pb-20 pt-[calc(var(--nav-height)+2.5rem)] sm:px-6 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-300/90">
            Pakistan Stock Exchange
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-[rgb(var(--azee-chalk))] sm:text-4xl">
            Company Announcements
          </h1>
          {/* Brand-signature stripe — same motif as the other page
              headings (mt-4 under this 3xl/4xl heading). */}
          <div className="mt-4 h-[3px] w-16 rounded-full bg-gradient-to-r from-[rgb(var(--azee-orange))] to-[rgb(var(--azee-orange)/0)]" />
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gray-400 sm:text-base">
            Corporate disclosures filed with the Pakistan Stock Exchange — board
            meetings, financial results, dividend notices and other material
            announcements. Each entry links to the original PSX document.
          </p>

          {/* ── Filters ────────────────────────────────────────────── */}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <label className="relative block w-full sm:w-72">
              <span className="sr-only">Search announcements</span>
              <input
                type="text"
                inputMode="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search announcements…"
                className={INPUT_CLASS}
              />
            </label>

            {/* Symbol autocomplete over the Market Watch directory. */}
            <div className="relative w-full sm:w-56">
              <label className="block">
                <span className="sr-only">Filter by symbol</span>
                <input
                  type="text"
                  role="combobox"
                  aria-expanded={symbolOpen && suggestions.length > 0}
                  aria-autocomplete="list"
                  value={symbolInput}
                  onChange={(e) => {
                    setSymbolInput(e.target.value);
                    setSymbolOpen(true);
                    if (e.target.value.trim() === "" && symbolParam) applySymbol("");
                  }}
                  onFocus={() => setSymbolOpen(true)}
                  // Blur is deferred so a click on a suggestion lands first.
                  onBlur={() => setTimeout(() => setSymbolOpen(false), 150)}
                  placeholder="Symbol (e.g. OGDC)"
                  className={INPUT_CLASS}
                />
              </label>
              {symbolOpen && suggestions.length > 0 && (
                <ul
                  role="listbox"
                  aria-label="Symbol suggestions"
                  className="liquid-glass absolute z-20 mt-2 w-full overflow-hidden rounded-2xl py-1"
                >
                  {suggestions.map((quote) => (
                    <li key={quote.symbol}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={quote.symbol === symbolParam}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => applySymbol(quote.symbol)}
                        className="flex w-full items-baseline gap-2 px-4 py-2 text-left text-sm text-white transition-colors duration-200 hover:bg-white/10"
                      >
                        <span className="font-semibold tracking-wide">
                          {quote.symbol}
                        </span>
                        {quote.name && (
                          <span className="truncate text-xs text-gray-400">
                            {quote.name}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <label className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Sector
              </span>
              <select
                aria-label="Sector"
                value={sector}
                disabled={controlsLocked}
                onChange={(e) => setParam("sector", e.target.value)}
                className={`${INPUT_CLASS} ${DISABLED_CLASS} w-auto [color-scheme:dark]`}
              >
                <option value="">All sectors</option>
                {sectors.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
              <input
                type="checkbox"
                aria-label="Shariah-compliant (KMI)"
                checked={shariah}
                disabled={controlsLocked}
                onChange={(e) => setParam("shariah", e.target.checked ? "1" : "")}
                className="h-4 w-4 rounded border-white/20 bg-transparent accent-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
              />
              Shariah-compliant (KMI)
            </label>

            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  From
                </span>
                <input
                  type="date"
                  aria-label="From date"
                  value={fromParam}
                  max={toParam || undefined}
                  onChange={(e) => setParam("from", e.target.value)}
                  // color-scheme keeps the native picker and its icon
                  // legible on this dark ground.
                  className={`${INPUT_CLASS} w-auto [color-scheme:dark]`}
                />
              </label>
              <label className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  To
                </span>
                <input
                  type="date"
                  aria-label="To date"
                  value={toParam}
                  min={fromParam || undefined}
                  onChange={(e) => setParam("to", e.target.value)}
                  className={`${INPUT_CLASS} w-auto [color-scheme:dark]`}
                />
              </label>
            </div>

            {filtersActive && (
              <button
                type="button"
                onClick={clearFilters}
                className="liquid-glass rounded-full px-5 py-2 text-xs font-semibold text-white transition-all duration-300 hover:bg-white/15"
              >
                Clear filters
              </button>
            )}
          </div>

          {/* ── Filing type ────────────────────────────────────────── */}
          <div
            role="tablist"
            aria-label="Filing type"
            className="mt-5 flex flex-wrap gap-2"
          >
            <button
              type="button"
              role="tab"
              aria-selected={category === null}
              onClick={() => setParam("category", "")}
              className={pillClass(category === null)}
            >
              All
              {clientFiltering && batch && (
                <span className="ml-1.5 tabular-nums opacity-60">
                  {working.length}
                </span>
              )}
            </button>
            {CATEGORY_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={category === tab.id}
                onClick={() => setParam("category", tab.id)}
                className={pillClass(category === tab.id)}
              >
                {tab.label}
                {/* Counts are shown only on the 100-row batch, where every
                    tab describes the same filings. On the default 50-row
                    page they would change the moment a tab was chosen and
                    the batch doubled. */}
                {clientFiltering && batch && (
                  <span className="ml-1.5 tabular-nums opacity-60">
                    {tabCounts[tab.id]}
                  </span>
                )}
              </button>
            ))}
          </div>
          {/* What the tag MEANS — kept separate from the batch disclaimer
              below, which is about how much of the data is on screen. */}
          <p className="mt-2 text-xs text-gray-400">
            Filing type is auto-tagged by AZEE from each filing&apos;s title — it
            is not a category published by PSX.
          </p>

          {rangeIncomplete && (
            <p className="mt-3 text-xs text-amber-200/90">
              Add both a start and end date to filter by range.
            </p>
          )}

          {controlsLocked && (
            <p className="mt-3 text-xs text-gray-400">
              Showing {symbolParam} only — sector and Shariah-compliant filters
              don&apos;t apply to a single company.
            </p>
          )}

          {/*
           * How much of the data is on screen. One generic sentence for
           * every client-side filter, so the copy does not fragment into
           * per-filter combinations as more are added.
           */}
          {clientFiltering && (
            <p className="mt-3 max-w-3xl text-xs leading-relaxed text-amber-200/90">
              Showing matches from the most recent {CLIENT_BATCH} PSX filings —
              not a complete history for these filters; use Next to look
              further back.
            </p>
          )}

          {shariah && (
            /* Same methodology language Market Watch carries — index
               membership, never individual religious advice. */
            <p className="mt-3 max-w-3xl text-xs leading-relaxed text-gray-400/90">
              <span className="font-semibold text-gray-300">KMI-30</span> and{" "}
              <span className="font-semibold text-gray-300">KMI All-Share</span>{" "}
              indicate a symbol&apos;s membership in the Pakistan Stock
              Exchange&apos;s official Shariah-compliant indices, screened per the
              published PSX KMI index methodology. This is a statement of index
              membership — not individual religious advice.
            </p>
          )}

          <div className="liquid-glass glass-sheen mt-6 overflow-hidden rounded-3xl">
            {error && !batch ? (
              <div className="px-6 py-16 text-center text-sm text-gray-400">
                Company announcements are temporarily unavailable. Please try
                again shortly.
              </div>
            ) : loading && !batch ? (
              <div className="px-6 py-16 text-center text-sm text-gray-400">
                Loading announcements…
              </div>
            ) : noResults ? (
              <div className="px-6 py-16 text-center">
                <p className="text-sm text-gray-300">
                  {emptyForCategory
                    ? `No filings in this batch of ${batchSize} are tagged ${categoryLabel}.`
                    : emptyBatchFiltered
                      ? `No filings in this batch of ${batchSize} match these filters.`
                      : filtersActive
                        ? "No announcements match these filters."
                        : "PSX is not publishing any company announcements right now."}
                </p>
                {filtersActive && (
                  <>
                    <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-gray-400">
                      {emptyForCategory || emptyBatchFiltered
                        ? "Use Next to search further back through PSX's filings, or widen the filters."
                        : "PSX searches whole words in the filing, so a partial word finds nothing. Try a shorter search, or widen the dates."}
                    </p>
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="liquid-glass mt-5 rounded-full px-5 py-2 text-xs font-semibold text-white transition-all duration-300 hover:bg-white/15"
                    >
                      Clear filters
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-blue-200/15 text-left">
                      {COLUMNS.map((label) => (
                        <th
                          key={label}
                          scope="col"
                          className="px-5 py-3.5 text-left font-semibold text-gray-300"
                        >
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((a: CompanyAnnouncement) => (
                      <tr
                        key={a.id}
                        className="border-b border-white/5 transition-colors duration-200 last:border-b-0 hover:bg-white/[0.04]"
                      >
                        <td className="whitespace-nowrap px-5 py-3.5 tabular-nums text-gray-300">
                          {a.dateText}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3.5 tabular-nums text-gray-400">
                          {a.timeText}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3.5 font-semibold tracking-wide text-white">
                          {a.symbol}
                        </td>
                        <td className="px-5 py-3.5 text-gray-300">
                          {a.companyName}
                        </td>
                        <td className="px-5 py-3.5">
                          {a.documentUrl ? (
                            /*
                             * Links straight to PSX's original filing —
                             * the document is never rehosted, and the
                             * link text is the filing's own title.
                             */
                            <a
                              href={a.documentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-white/90 underline decoration-blue-300/40 underline-offset-4 transition-colors duration-300 hover:text-white hover:decoration-blue-300"
                            >
                              {a.title}
                              {a.documentType === "image" && (
                                <span className="ml-2 text-[10px] uppercase tracking-wider text-gray-500">
                                  scan
                                </span>
                              )}
                            </a>
                          ) : (
                            // PSX published the row without a retrievable
                            // file; shown as plain text rather than a
                            // link that would go nowhere.
                            <span className="text-gray-300">{a.title}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {batch && (
            <>
              {batchSize > 0 && (
                /* Pager — counts come from PSX's own "Showing X to Y of Z
                   entries" header, never a client-side estimate. Under a
                   PSX-side filter that header is the FILTERED total
                   (verified), so "of N" still describes what is on
                   screen. Under a client-side filter it describes the
                   batch that was searched, and the match count is stated
                   separately so the two are never conflated. */
                <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
                  {clientFiltering ? (
                    <p className="text-xs text-gray-400 tabular-nums">
                      {rows.length.toLocaleString("en-US")}{" "}
                      {rows.length === 1 ? "match" : "matches"} in filings{" "}
                      {from.toLocaleString("en-US")}–{to.toLocaleString("en-US")}
                      {total !== null && (
                        <> of {total.toLocaleString("en-US")}</>
                      )}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-400 tabular-nums">
                      Showing {from.toLocaleString("en-US")}–
                      {to.toLocaleString("en-US")}
                      {total !== null && (
                        <> of {total.toLocaleString("en-US")} announcements</>
                      )}
                    </p>
                  )}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => goTo(page - 1)}
                      disabled={!hasPrev}
                      className="liquid-glass rounded-full px-5 py-2 text-xs font-semibold text-white transition-all duration-300 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                    >
                      ← Previous
                    </button>
                    <span className="px-1 text-xs text-gray-400 tabular-nums">
                      Page {page.toLocaleString("en-US")}
                    </span>
                    <button
                      type="button"
                      onClick={() => goTo(page + 1)}
                      disabled={!hasNext}
                      className="liquid-glass rounded-full px-5 py-2 text-xs font-semibold text-white transition-all duration-300 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}

              <p className="mt-4 max-w-3xl text-xs leading-relaxed text-gray-400/90">
                {stale && (
                  <>
                    <span className="font-semibold text-gray-300">
                      Showing the last confirmed page —
                    </span>{" "}
                    live PSX data is temporarily unavailable, so newer filings
                    may be missing.{" "}
                  </>
                )}
                Announcements are shown exactly as filed with the Pakistan Stock
                Exchange — titles are the companies&apos; own wording, and each
                links to the original PSX document. AZEE does not summarize or
                interpret disclosures. A small number of filings are published
                by PSX only as a scan; those are marked.
              </p>
            </>
          )}
        </div>
      </section>

      <Footer />
    </main>
  );
}
