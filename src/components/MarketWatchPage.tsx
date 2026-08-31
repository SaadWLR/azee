import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { useAllMarketQuotes } from "../hooks/useMarketData";
import { usePageMeta } from "../hooks/usePageMeta";
import type { StockQuote } from "../types";

/*
 * Live Market Watch — the full PSX quote table.
 *
 * Company name and sector name come from PSX's own symbol directory,
 * joined to each quote by ticker server-side (api/market/psx-watch.ts).
 * Both are OPTIONAL by design: a symbol the directory does not carry,
 * or a directory outage, leaves the row showing its bare ticker — which
 * is exactly what this page showed before the join existed. Nothing is
 * ever guessed or prettified to fill the gap.
 *
 * Still not available from this source, and so still absent rather than
 * fabricated: fundamentals of any kind.
 */

type SortColumn =
  | "symbol"
  | "sector"
  | "price"
  | "changePercent"
  | "changePoints"
  | "volume";
type SortDir = "asc" | "desc";
type Preset = "all" | "gainers" | "losers" | "active" | "kmi30" | "kmiAllShare";

const PAGE_SIZE = 50;

const PRESETS: { id: Preset; label: string }[] = [
  { id: "all", label: "All" },
  { id: "gainers", label: "Gainers" },
  { id: "losers", label: "Losers" },
  { id: "active", label: "Most Active" },
  { id: "kmi30", label: "KMI-30" },
  { id: "kmiAllShare", label: "KMI All-Share" },
];

const COLUMNS: { id: SortColumn; label: string; numeric: boolean }[] = [
  { id: "symbol", label: "Symbol", numeric: false },
  { id: "sector", label: "Sector", numeric: false },
  { id: "price", label: "Price", numeric: true },
  { id: "changePercent", label: "Change %", numeric: true },
  { id: "changePoints", label: "Change", numeric: true },
  { id: "volume", label: "Volume", numeric: true },
];

/** Each preset carries its natural default sort. */
const PRESET_SORT: Record<Preset, { column: SortColumn; dir: SortDir }> = {
  all: { column: "symbol", dir: "asc" },
  // Sector sorts A→Z like Symbol; the numeric columns default desc.
  gainers: { column: "changePercent", dir: "desc" },
  losers: { column: "changePercent", dir: "asc" },
  active: { column: "volume", dir: "desc" },
  kmi30: { column: "symbol", dir: "asc" },
  kmiAllShare: { column: "symbol", dir: "asc" },
};

/**
 * Membership badge label for a row, or null. KMI-30 (the 30-stock
 * index) is shown in preference to the broader KMI All-Share, since a
 * KMI-30 constituent is by definition also in KMI All-Share.
 */
function membershipBadge(quote: StockQuote): string | null {
  if (quote.isKmi30) return "KMI-30";
  if (quote.isKmiAllShare) return "KMI All-Share";
  return null;
}

function fmtNum(value: number | undefined, dp = 2): string {
  if (value === undefined || !Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  });
}

function fmtVolume(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return "—";
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return String(value);
}

function ChangeCell({ value, suffix }: { value: number | undefined; suffix: string }) {
  if (value === undefined || !Number.isFinite(value)) {
    return <span className="text-gray-500">—</span>;
  }
  const up = value >= 0;
  return (
    <span className={up ? "text-emerald-400" : "text-rose-400"}>
      {up ? "▲ +" : "▼ "}
      {fmtNum(Math.abs(value))}
      {suffix}
    </span>
  );
}

export function MarketWatchPage() {
  usePageMeta(
    "Market Watch — Live PSX Stock Prices | AZEE Trade",
    "Live prices for all ~490 Pakistan Stock Exchange symbols with company names and sectors — sortable and searchable, with KMI-30, gainers, and losers filters, updated through the trading session.",
  );
  const { data: quotes, loading, error } = useAllMarketQuotes();
  const [preset, setPreset] = useState<Preset>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ column: SortColumn; dir: SortDir }>(
    PRESET_SORT.all,
  );
  const [page, setPage] = useState(1);

  function applyPreset(next: Preset) {
    setPreset(next);
    setSort(PRESET_SORT[next]);
    setPage(1);
  }

  function toggleSort(column: SortColumn) {
    setSort((prev) =>
      prev.column === column
        ? { column, dir: prev.dir === "asc" ? "desc" : "asc" }
        : {
            column,
            dir: column === "symbol" || column === "sector" ? "asc" : "desc",
          },
    );
    setPage(1);
  }

  const processed = useMemo(() => {
    let rows = quotes ?? [];

    // Preset filter (views over data already in hand — not new data).
    if (preset === "gainers") rows = rows.filter((q) => q.changePercent > 0);
    else if (preset === "losers") rows = rows.filter((q) => q.changePercent < 0);
    else if (preset === "kmi30") rows = rows.filter((q) => q.isKmi30);
    else if (preset === "kmiAllShare") rows = rows.filter((q) => q.isKmiAllShare);
    // "active" and "all" include every row; their difference is sort.

    /*
     * Text filter across ticker, company name and sector — now that the
     * latter two are real, "searching" for a company by its name or a
     * whole sector is the obvious expectation. Rows without a name or
     * sector simply match on ticker, as they always did.
     */
    const term = search.trim().toUpperCase();
    if (term) {
      rows = rows.filter(
        (q) =>
          q.symbol.includes(term) ||
          q.name?.toUpperCase().includes(term) ||
          q.sector?.toUpperCase().includes(term),
      );
    }

    // Sort.
    const { column, dir } = sort;
    const factor = dir === "asc" ? 1 : -1;
    rows = [...rows].sort((a, b) => {
      if (column === "symbol") return factor * a.symbol.localeCompare(b.symbol);
      if (column === "sector") {
        /*
         * Rows with no sector sort last in BOTH directions rather than
         * leading the ascending view with a block of blanks; ties fall
         * back to ticker so the order is stable and readable.
         */
        const as = a.sector ?? "";
        const bs = b.sector ?? "";
        if (!as !== !bs) return as ? -1 : 1;
        return (
          factor * as.localeCompare(bs) || a.symbol.localeCompare(b.symbol)
        );
      }
      const av = (a[column] as number | undefined) ?? -Infinity;
      const bv = (b[column] as number | undefined) ?? -Infinity;
      return factor * (av - bv);
    });
    return rows;
  }, [quotes, preset, search, sort]);

  const totalPages = Math.max(1, Math.ceil(processed.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = processed.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  return (
    <main className="min-h-screen text-white">
      <Navbar />

      <section className="section-tint-a relative px-4 pb-20 pt-[calc(var(--nav-height)+2.5rem)] sm:px-6 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-300/90">
            Pakistan Stock Exchange
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-[rgb(var(--azee-chalk))] sm:text-4xl">
            Market Watch
          </h1>
          {/* Brand-signature stripe — same motif as the hero headline
              (mt-4 sits it under this page's more compact heading). */}
          <div className="mt-4 h-[3px] w-16 rounded-full bg-gradient-to-r from-[rgb(var(--azee-orange))] to-[rgb(var(--azee-orange)/0)]" />
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gray-400 sm:text-base">
            Live quotes for every symbol trading on the PSX ready board —
            company name, sector, price, change, and volume, sortable and
            searchable. Data from the Pakistan Stock Exchange.
          </p>

          {/* Controls */}
          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p.id)}
                  className={`rounded-full px-4 py-2 text-xs font-semibold transition-all duration-300 ${
                    preset === p.id
                      ? "bg-white text-black"
                      : "liquid-glass text-white hover:bg-white/15"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <label className="relative block w-full sm:w-64">
              <span className="sr-only">Search by symbol, company or sector</span>
              <input
                type="text"
                inputMode="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search symbol, company or sector…"
                className="liquid-glass w-full rounded-full px-4 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400/40"
              />
            </label>
          </div>

          {/* Methodology note — required, always visible, never phrased
              as a religious ruling. Do not drop for visual simplicity. */}
          <p className="mt-4 max-w-3xl text-xs leading-relaxed text-gray-400/90">
            <span className="font-semibold text-gray-300">KMI-30</span> and{" "}
            <span className="font-semibold text-gray-300">KMI All-Share</span>{" "}
            indicate a symbol&apos;s membership in the Pakistan Stock
            Exchange&apos;s official Shariah-compliant indices, screened per the
            published PSX KMI index methodology. This is a statement of index
            membership — not individual religious advice.
          </p>

          {/* Table / states */}
          <div className="liquid-glass glass-sheen mt-6 overflow-hidden rounded-3xl">
            {error && !quotes ? (
              <div className="px-6 py-16 text-center text-sm text-gray-400">
                Market data is temporarily unavailable. Please try again
                shortly.
              </div>
            ) : loading && !quotes ? (
              <div className="px-6 py-16 text-center text-sm text-gray-400">
                Loading live quotes…
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-blue-200/15 text-left">
                      {COLUMNS.map((col) => {
                        const activeSort = sort.column === col.id;
                        return (
                          <th
                            key={col.id}
                            scope="col"
                            className={`px-5 py-3.5 font-semibold text-gray-300 ${
                              col.numeric ? "text-right" : "text-left"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => toggleSort(col.id)}
                              className={`inline-flex items-center gap-1 transition-colors duration-300 hover:text-white ${
                                col.numeric ? "flex-row-reverse" : ""
                              } ${activeSort ? "text-white" : ""}`}
                            >
                              <span>{col.label}</span>
                              <span className="text-[10px] text-blue-300">
                                {activeSort ? (sort.dir === "asc" ? "▲" : "▼") : ""}
                              </span>
                            </button>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((quote: StockQuote) => (
                      <tr
                        key={quote.symbol}
                        className="border-b border-white/5 transition-colors duration-200 last:border-b-0 hover:bg-white/[0.04]"
                      >
                        <td className="px-5 py-3">
                          <span className="flex items-center gap-2">
                            {/* A real anchor on the symbol, not a
                                clickable row: the row would need its own
                                keyboard and focus handling to be usable,
                                and this is already both. */}
                            <Link
                              to={`/market-watch/${quote.symbol}`}
                              className="font-semibold tracking-wide text-white transition-colors duration-300 hover:text-blue-300"
                            >
                              {quote.symbol}
                            </Link>
                            {membershipBadge(quote) && (
                              <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-emerald-300">
                                {membershipBadge(quote)}
                              </span>
                            )}
                          </span>
                          {/* PSX's published company name. Omitted
                              entirely when the directory has no entry —
                              the ticker above already identifies the
                              row, so a missing name costs nothing. */}
                          {quote.name && (
                            <span className="mt-0.5 block max-w-[22rem] truncate text-xs text-gray-400">
                              {quote.name}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          {quote.sector ? (
                            <span className="text-xs text-gray-300">
                              {quote.sector}
                            </span>
                          ) : (
                            <span className="text-gray-500">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums text-white">
                          {fmtNum(quote.price)}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums">
                          <ChangeCell value={quote.changePercent} suffix="%" />
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums">
                          <ChangeCell value={quote.changePoints} suffix="" />
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums text-gray-300">
                          {fmtVolume(quote.volume)}
                        </td>
                      </tr>
                    ))}
                    {pageRows.length === 0 && (
                      <tr>
                        <td
                          colSpan={COLUMNS.length}
                          className="px-5 py-16 text-center text-sm text-gray-400"
                        >
                          No symbols, companies or sectors match “{search}”.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Pagination */}
          {quotes && processed.length > 0 && (
            <div className="mt-5 flex items-center justify-between text-xs text-gray-400">
              <p className="tabular-nums">
                {(currentPage - 1) * PAGE_SIZE + 1}–
                {Math.min(currentPage * PAGE_SIZE, processed.length)} of{" "}
                {processed.length} symbols
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="liquid-glass rounded-full px-4 py-2 font-semibold text-white transition-all duration-300 enabled:hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Prev
                </button>
                <span className="tabular-nums">
                  Page {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="liquid-glass rounded-full px-4 py-2 font-semibold text-white transition-all duration-300 enabled:hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      <Footer />
    </main>
  );
}
