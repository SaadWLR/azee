import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { useFullIndices } from "../hooks/useMarketData";
import { usePageMeta } from "../hooks/usePageMeta";
import { getIndexConstituents } from "../services/marketService";
import type { FullIndexQuote, IndexConstituentsResponse } from "../types";

/*
 * Live PSX benchmark indices — the 10 headline indices with High/Low/
 * Current/Change/%Change and a derived per-index volume, from
 * /api/market/indices-full. Each row expands (on demand) to its real
 * constituent companies from /api/market/index-constituents. PSX
 * exposes no traded-value/turnover metric for an index, so there is
 * deliberately no "Value" column — the table shows exactly what the
 * data carries and never fabricates the rest.
 */

type SortColumn =
  | "index"
  | "value"
  | "changePoints"
  | "changePercent"
  | "high"
  | "low"
  | "volume";
type SortDir = "asc" | "desc";

const COLUMNS: { id: SortColumn; label: string; numeric: boolean }[] = [
  { id: "index", label: "Index", numeric: false },
  { id: "value", label: "Current", numeric: true },
  { id: "changePoints", label: "Change", numeric: true },
  { id: "changePercent", label: "Change %", numeric: true },
  { id: "high", label: "High", numeric: true },
  { id: "low", label: "Low", numeric: true },
  { id: "volume", label: "Volume", numeric: true },
];

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

function ChangeCell({
  value,
  suffix,
}: {
  value: number | undefined;
  suffix: string;
}) {
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

/**
 * The expanded constituents panel for one index. Fetches on mount (so
 * data is pulled only when a row is actually opened), reading through a
 * shared cache so re-expanding a code doesn't refetch. The list lives in
 * a fixed-height scroll container: even ALLSHR's ~550 rows can never
 * push the page into an unbounded-height expansion.
 *
 * Compact 6-column view — Symbol, Company, Current, Change %, Weight %,
 * Volume — chosen from the 11 available fields: enough to identify the
 * company and see how it's moving and how much of the index it drives
 * (weight is the field unique to this drill-down), without cramming
 * LDCP/points/free-float/market-cap into an inline row.
 */
function ConstituentsPanel({
  code,
  cache,
}: {
  code: string;
  cache: Map<string, IndexConstituentsResponse>;
}) {
  const [state, setState] = useState<{
    loading: boolean;
    error: boolean;
    data?: IndexConstituentsResponse;
  }>(() => {
    const cached = cache.get(code);
    return cached
      ? { loading: false, error: false, data: cached }
      : { loading: true, error: false };
  });

  useEffect(() => {
    if (cache.has(code)) return;
    let alive = true;
    getIndexConstituents(code)
      .then((r) => {
        cache.set(code, r);
        if (alive) setState({ loading: false, error: false, data: r });
      })
      .catch(() => {
        if (alive) setState({ loading: false, error: true });
      });
    return () => {
      alive = false;
    };
  }, [code, cache]);

  if (state.loading) {
    return (
      <div className="px-5 py-6 text-center text-xs text-gray-400">
        Loading constituents…
      </div>
    );
  }
  if (state.error || !state.data) {
    return (
      <div className="px-5 py-6 text-center text-xs text-gray-400">
        Constituents are temporarily unavailable.
      </div>
    );
  }

  const { constituents, count } = state.data;
  return (
    <div className="bg-white/[0.02] px-3 py-3 sm:px-5">
      <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-blue-300/80">
        {count} constituents
      </p>
      <div className="max-h-96 overflow-y-auto rounded-xl border border-white/10">
        <table className="w-full min-w-[560px] border-collapse text-xs">
          <thead className="sticky top-0 bg-[rgb(var(--azee-navy))]">
            <tr className="text-left text-gray-400">
              <th className="px-4 py-2 font-semibold">Symbol</th>
              <th className="px-4 py-2 font-semibold">Company</th>
              <th className="px-4 py-2 text-right font-semibold">Current</th>
              <th className="px-4 py-2 text-right font-semibold">Change %</th>
              <th className="px-4 py-2 text-right font-semibold">Weight %</th>
              <th className="px-4 py-2 text-right font-semibold">Volume</th>
            </tr>
          </thead>
          <tbody>
            {constituents.map((c) => (
              <tr key={c.symbol} className="border-t border-white/5">
                <td className="px-4 py-2 font-semibold tracking-wide text-white">
                  {c.symbol}
                </td>
                <td className="px-4 py-2 text-gray-300">{c.name}</td>
                <td className="px-4 py-2 text-right tabular-nums text-white">
                  {fmtNum(c.current)}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  <ChangeCell value={c.changePercent} suffix="%" />
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-gray-300">
                  {fmtNum(c.indexWeight)}%
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-gray-300">
                  {fmtVolume(c.volume)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function IndicesPage() {
  usePageMeta(
    "PSX Indices — Live Benchmark Index Values | AZEE Trade",
    "Live values for the Pakistan Stock Exchange's benchmark indices — KSE-100, KSE-30, KSE All Share, KMI-30, KMI All Share, PSX Dividend 20, and the Banking, Oil & Gas, UBL Enterprise and NIT Gateway tradable indices — with high, low, change, and volume.",
  );
  const { data, loading, error } = useFullIndices();
  const indices = data?.indices;
  // Default: the feed's own curated order (broad-market first). A header
  // click switches to an explicit column sort.
  const [sort, setSort] = useState<{ column: SortColumn; dir: SortDir } | null>(
    null,
  );
  // Which index rows are expanded, and a session cache of fetched
  // constituents so re-expanding never refetches.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const cacheRef = useRef<Map<string, IndexConstituentsResponse>>(new Map());

  function toggleSort(column: SortColumn) {
    setSort((prev) =>
      prev && prev.column === column
        ? { column, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { column, dir: column === "index" ? "asc" : "desc" },
    );
  }

  function toggleExpand(code: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  const rows = useMemo(() => {
    const list = indices ?? [];
    if (!sort) return list;
    const { column, dir } = sort;
    const factor = dir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      if (column === "index") return factor * a.code.localeCompare(b.code);
      return factor * (a[column] - b[column]);
    });
  }, [indices, sort]);

  return (
    <main className="min-h-screen text-white">
      <Navbar />

      <section className="section-tint-a relative px-4 pb-20 pt-[calc(var(--nav-height)+2.5rem)] sm:px-6 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-300/90">
            Pakistan Stock Exchange
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Indices
          </h1>
          {/* Brand-signature stripe — same motif as the other page
              headings (mt-4 under this 3xl/4xl heading). */}
          <div className="mt-4 h-[3px] w-16 rounded-full bg-gradient-to-r from-[rgb(var(--azee-orange))] to-[rgb(var(--azee-orange)/0)]" />
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gray-400 sm:text-base">
            Live values for the Pakistan Stock Exchange&apos;s benchmark
            indices — current level, session high and low, change, and traded
            volume. Select any index to see its constituent companies. Data
            from the Pakistan Stock Exchange.
          </p>

          {/* Table / states — same liquid-glass card as Market Watch. */}
          <div className="liquid-glass glass-sheen mt-8 overflow-hidden rounded-3xl">
            {error && !indices ? (
              <div className="px-6 py-16 text-center text-sm text-gray-400">
                Index data is temporarily unavailable. Please try again shortly.
              </div>
            ) : loading && !indices ? (
              <div className="px-6 py-16 text-center text-sm text-gray-400">
                Loading live indices…
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-blue-200/15 text-left">
                      {COLUMNS.map((col) => {
                        const activeSort = sort?.column === col.id;
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
                                {activeSort ? (sort?.dir === "asc" ? "▲" : "▼") : ""}
                              </span>
                            </button>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((index: FullIndexQuote) => {
                      const isOpen = expanded.has(index.code);
                      return (
                        <Fragment key={index.code}>
                          <tr
                            onClick={() => toggleExpand(index.code)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                toggleExpand(index.code);
                              }
                            }}
                            tabIndex={0}
                            role="button"
                            aria-expanded={isOpen}
                            className="cursor-pointer border-b border-white/5 transition-colors duration-200 last:border-b-0 hover:bg-white/[0.04] focus:outline-none focus-visible:bg-white/[0.06]"
                          >
                            <td className="px-5 py-3.5">
                              <span className="flex items-center gap-2.5">
                                <span
                                  aria-hidden="true"
                                  className={`text-[10px] text-blue-300 transition-transform duration-200 ${
                                    isOpen ? "rotate-90" : ""
                                  }`}
                                >
                                  ▶
                                </span>
                                <span className="flex flex-col">
                                  <span className="font-semibold tracking-wide text-white">
                                    {index.code}
                                  </span>
                                  <span className="text-xs text-gray-400">
                                    {index.name}
                                  </span>
                                </span>
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-right tabular-nums text-white">
                              {fmtNum(index.value)}
                            </td>
                            <td className="px-5 py-3.5 text-right tabular-nums">
                              <ChangeCell value={index.changePoints} suffix="" />
                            </td>
                            <td className="px-5 py-3.5 text-right tabular-nums">
                              <ChangeCell value={index.changePercent} suffix="%" />
                            </td>
                            <td className="px-5 py-3.5 text-right tabular-nums text-gray-300">
                              {fmtNum(index.high)}
                            </td>
                            <td className="px-5 py-3.5 text-right tabular-nums text-gray-300">
                              {fmtNum(index.low)}
                            </td>
                            <td className="px-5 py-3.5 text-right tabular-nums text-gray-300">
                              {fmtVolume(index.volume)}
                            </td>
                          </tr>
                          {isOpen && (
                            <tr className="border-b border-white/5 last:border-b-0">
                              <td colSpan={COLUMNS.length} className="p-0">
                                <ConstituentsPanel
                                  code={index.code}
                                  cache={cacheRef.current}
                                />
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {indices && (
            <p className="mt-4 text-xs leading-relaxed text-gray-400/90">
              Volume is the combined traded volume of each index&apos;s
              constituents. The Pakistan Stock Exchange publishes no
              traded-value figure per index, so none is shown.
            </p>
          )}
        </div>
      </section>

      <Footer />
    </main>
  );
}
