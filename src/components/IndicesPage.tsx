import { useMemo, useState } from "react";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { useFullIndices } from "../hooks/useMarketData";
import { usePageMeta } from "../hooks/usePageMeta";
import type { FullIndexQuote } from "../types";

/*
 * Live PSX benchmark indices — the 10 headline indices with High/Low/
 * Current/Change/%Change and a derived per-index volume, from
 * /api/market/indices-full. PSX exposes no traded-value/turnover metric
 * for an index, so there is deliberately no "Value" column — the table
 * shows exactly what the data carries and never fabricates the rest.
 * Constituent drill-down is a later milestone; rows are not clickable.
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

  function toggleSort(column: SortColumn) {
    setSort((prev) =>
      prev && prev.column === column
        ? { column, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { column, dir: column === "index" ? "asc" : "desc" },
    );
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
            volume. Data from the Pakistan Stock Exchange.
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
                    {rows.map((index: FullIndexQuote) => (
                      <tr
                        key={index.code}
                        className="border-b border-white/5 transition-colors duration-200 last:border-b-0 hover:bg-white/[0.04]"
                      >
                        <td className="px-5 py-3.5">
                          <span className="flex flex-col">
                            <span className="font-semibold tracking-wide text-white">
                              {index.code}
                            </span>
                            <span className="text-xs text-gray-400">
                              {index.name}
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
                    ))}
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
