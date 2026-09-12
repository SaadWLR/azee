import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { useAnnouncements } from "../hooks/useCalendar";
import { usePageMeta } from "../hooks/usePageMeta";
import type { CompanyAnnouncement } from "../types/announcements";

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
 * FILTERS NARROW AT PSX, NOT HERE. Search and the date range are
 * forwarded to PSX's own query/date_from/date_to fields, so the rows
 * and the "of N" total always describe the same query. Filtering a
 * 50-row page client-side would silently mean "search the current
 * page", which against a 223k-filing corpus is not searching at all.
 */

const PAGE_SIZE = 50;

const COLUMNS = ["Date", "Time", "Symbol", "Company", "Announcement"];

/*
 * Long enough that ordinary typing commits once rather than per
 * keystroke, short enough to feel immediate. Each commit is a URL
 * change and a PSX fetch, so this is the difference between one
 * request and one per character.
 */
const SEARCH_DEBOUNCE_MS = 400;

/** The exact input treatment Market Watch uses — not a new one. */
const INPUT_CLASS =
  "liquid-glass w-full rounded-full px-4 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400/40";

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
  const offset = (page - 1) * PAGE_SIZE;

  const q = (searchParams.get("q") ?? "").trim();
  const fromParam = searchParams.get("from") ?? "";
  const toParam = searchParams.get("to") ?? "";

  /*
   * PSX ignores a one-sided range outright and answers with the whole
   * corpus (verified against the live endpoint), so a half-filled range
   * is never sent. The user is told why instead of watching a filter do
   * nothing.
   */
  const rangeComplete = Boolean(fromParam) && Boolean(toParam);
  const rangeIncomplete = Boolean(fromParam) !== Boolean(toParam);
  const filtersActive = Boolean(q) || Boolean(fromParam) || Boolean(toParam);

  const { data, loading, error } = useAnnouncements(PAGE_SIZE, offset, {
    q: q || undefined,
    dateFrom: rangeComplete ? fromParam : undefined,
    dateTo: rangeComplete ? toParam : undefined,
  });
  const announcements = data?.announcements;
  const rows = announcements ?? [];
  const total = data?.totalAvailable ?? null;
  const stale = data?.stale;

  /*
   * The box holds keystrokes; the URL holds the committed query. They
   * are separate so typing stays responsive while only the debounced
   * value causes a fetch.
   */
  const [searchInput, setSearchInput] = useState(q);
  const committedQ = useRef(q);

  // Follow the URL when it changes from somewhere else — back/forward,
  // or Clear filters — without overwriting what is being typed.
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

  function setDateParam(which: "from" | "to", value: string) {
    setSearchParams((current) => {
      const params = new URLSearchParams(current);
      if (value) params.set(which, value);
      else params.delete(which);
      params.delete("page");
      return params;
    });
  }

  function clearFilters() {
    committedQ.current = "";
    setSearchInput("");
    setSearchParams((current) => {
      const params = new URLSearchParams(current);
      for (const key of ["q", "from", "to", "page"]) params.delete(key);
      return params;
    });
  }

  const from = offset + 1;
  const to = offset + rows.length;
  const hasPrev = page > 1;
  // Only offer Next while PSX's own total says there is more.
  const hasNext = total !== null ? to < total : rows.length === PAGE_SIZE;

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
   * Zero rows from a filter is a real answer, not an outage. It gets
   * its own state so it can never borrow the "temporarily unavailable"
   * copy, which would report a working search as a broken feed.
   */
  const noResults = Boolean(announcements) && rows.length === 0;

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
                  onChange={(e) => setDateParam("from", e.target.value)}
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
                  onChange={(e) => setDateParam("to", e.target.value)}
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

          {rangeIncomplete && (
            <p className="mt-3 text-xs text-amber-200/90">
              Add both a start and end date to filter by range.
            </p>
          )}

          <div className="liquid-glass glass-sheen mt-6 overflow-hidden rounded-3xl">
            {error && !announcements ? (
              <div className="px-6 py-16 text-center text-sm text-gray-400">
                Company announcements are temporarily unavailable. Please try
                again shortly.
              </div>
            ) : loading && !announcements ? (
              <div className="px-6 py-16 text-center text-sm text-gray-400">
                Loading announcements…
              </div>
            ) : noResults ? (
              <div className="px-6 py-16 text-center">
                <p className="text-sm text-gray-300">
                  {filtersActive
                    ? "No announcements match these filters."
                    : "PSX is not publishing any company announcements right now."}
                </p>
                {filtersActive && (
                  <>
                    <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-gray-400">
                      PSX searches whole words in the filing, so a partial word
                      finds nothing. Try a shorter search, or widen the dates.
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

          {announcements && (
            <>
              {rows.length > 0 && (
                /* Pager — counts come from PSX's own "Showing X to Y of Z
                   entries" header, never a client-side estimate. Under a
                   filter that header is the FILTERED total (verified), so
                   "of N" still describes what is on screen. */
                <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
                  <p className="text-xs text-gray-400 tabular-nums">
                    Showing {from.toLocaleString("en-US")}–
                    {to.toLocaleString("en-US")}
                    {total !== null && (
                      <> of {total.toLocaleString("en-US")} announcements</>
                    )}
                  </p>
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
