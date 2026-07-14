import { useMemo, useState } from "react";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { useAllMarketQuotes } from "../hooks/useMarketData";
import type { StockQuote } from "../types";

/*
 * Live Market Watch — the full PSX quote table. Data limits of the
 * source (see getAllMarketQuotes): symbols only (no company names),
 * no sector names, no fundamentals. The table shows exactly what the
 * StockQuote carries and never fabricates the rest.
 */

type SortColumn = "symbol" | "price" | "changePercent" | "changePoints" | "volume";
type SortDir = "asc" | "desc";
type Preset = "all" | "gainers" | "losers" | "active";

const PAGE_SIZE = 50;

const PRESETS: { id: Preset; label: string }[] = [
  { id: "all", label: "All" },
  { id: "gainers", label: "Gainers" },
  { id: "losers", label: "Losers" },
  { id: "active", label: "Most Active" },
];

const COLUMNS: { id: SortColumn; label: string; numeric: boolean }[] = [
  { id: "symbol", label: "Symbol", numeric: false },
  { id: "price", label: "Price", numeric: true },
  { id: "changePercent", label: "Change %", numeric: true },
  { id: "changePoints", label: "Change", numeric: true },
  { id: "volume", label: "Volume", numeric: true },
];

/** Each preset carries its natural default sort. */
const PRESET_SORT: Record<Preset, { column: SortColumn; dir: SortDir }> = {
  all: { column: "symbol", dir: "asc" },
  gainers: { column: "changePercent", dir: "desc" },
  losers: { column: "changePercent", dir: "asc" },
  active: { column: "volume", dir: "desc" },
};

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
        : { column, dir: column === "symbol" ? "asc" : "desc" },
    );
    setPage(1);
  }

  const processed = useMemo(() => {
    let rows = quotes ?? [];

    // Preset filter (views over data already in hand — not new data).
    if (preset === "gainers") rows = rows.filter((q) => q.changePercent > 0);
    else if (preset === "losers") rows = rows.filter((q) => q.changePercent < 0);
    // "active" and "all" include every row; their difference is sort.

    // Symbol text filter.
    const term = search.trim().toUpperCase();
    if (term) rows = rows.filter((q) => q.symbol.includes(term));

    // Sort.
    const { column, dir } = sort;
    const factor = dir === "asc" ? 1 : -1;
    rows = [...rows].sort((a, b) => {
      if (column === "symbol") return factor * a.symbol.localeCompare(b.symbol);
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
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Market Watch
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gray-400 sm:text-base">
            Live quotes for every symbol trading on the PSX ready board —
            price, change, and volume, sortable and searchable. Data from the
            Pakistan Stock Exchange.
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
              <span className="sr-only">Search by symbol</span>
              <input
                type="text"
                inputMode="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search symbol…"
                className="liquid-glass w-full rounded-full px-4 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400/40"
              />
            </label>
          </div>

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
                <table className="w-full min-w-[640px] border-collapse text-sm">
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
                        <td className="px-5 py-3 font-semibold tracking-wide text-white">
                          {quote.symbol}
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
                          No symbols match “{search}”.
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
