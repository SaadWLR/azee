import { useMemo, useState } from "react";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { useCorporateCalendar } from "../hooks/useCalendar";
import type { CorporateMeeting } from "../types";

/*
 * Corporate Calendar — upcoming AGM/EOGM meetings from the PSX Data
 * Portal, rendered as a sortable/filterable list (the same table
 * pattern as Market Watch, rather than a calendar-grid widget,
 * per the project's preference for extending established patterns).
 * Every entry is real PSX-reported data; nothing is fabricated.
 */

type TypeFilter = "all" | "AGM" | "EOGM";
type SortColumn = "date" | "company";
type SortDir = "asc" | "desc";

const TYPE_FILTERS: { id: TypeFilter; label: string }[] = [
  { id: "all", label: "All Meetings" },
  { id: "AGM", label: "AGM" },
  { id: "EOGM", label: "EOGM" },
];

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** "15:00" → "3:00 PM"; passes through anything unexpected verbatim. */
function formatTime(time: string | undefined): string {
  if (!time) return "—";
  const match = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!match) return time;
  const hours = Number(match[1]);
  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 === 0 ? 12 : hours % 12;
  return `${displayHours}:${match[2]} ${suffix}`;
}

export function CorporateCalendarPage() {
  const { data: calendar, loading, error } = useCorporateCalendar();
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ column: SortColumn; dir: SortDir }>({
    column: "date",
    dir: "asc",
  });

  function toggleSort(column: SortColumn) {
    setSort((prev) =>
      prev.column === column
        ? { column, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { column, dir: "asc" },
    );
  }

  const meetings = useMemo(() => {
    let rows = calendar?.meetings ?? [];
    if (typeFilter !== "all") {
      rows = rows.filter((m) => m.meetingType === typeFilter);
    }
    const term = search.trim().toUpperCase();
    if (term) {
      rows = rows.filter(
        (m) =>
          m.symbol.includes(term) ||
          m.companyName.toUpperCase().includes(term),
      );
    }
    const factor = sort.dir === "asc" ? 1 : -1;
    rows = [...rows].sort((a, b) =>
      sort.column === "date"
        ? factor * a.date.localeCompare(b.date)
        : factor * a.companyName.localeCompare(b.companyName),
    );
    return rows;
  }, [calendar, typeFilter, search, sort]);

  return (
    <main className="min-h-screen text-white">
      <Navbar />

      <section className="section-tint-a relative px-4 pb-20 pt-[calc(var(--nav-height)+2.5rem)] sm:px-6 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-300/90">
            Pakistan Stock Exchange
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Corporate Calendar
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gray-400 sm:text-base">
            Upcoming AGM and EOGM meetings of PSX-listed companies over the
            next 90 days — dates, times, and venues as reported to the
            Pakistan Stock Exchange.
          </p>

          {/* Controls */}
          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              {TYPE_FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setTypeFilter(f.id)}
                  className={`rounded-full px-4 py-2 text-xs font-semibold transition-all duration-300 ${
                    typeFilter === f.id
                      ? "bg-white text-black"
                      : "liquid-glass text-white hover:bg-white/15"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <label className="relative block w-full sm:w-72">
              <span className="sr-only">Search by symbol or company</span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search symbol or company…"
                className="liquid-glass w-full rounded-full px-4 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400/40"
              />
            </label>
          </div>

          {/* Table / states */}
          <div className="liquid-glass glass-sheen mt-6 overflow-hidden rounded-3xl">
            {error && !calendar ? (
              <div className="px-6 py-16 text-center text-sm text-gray-400">
                The corporate calendar is temporarily unavailable. Please try
                again shortly.
              </div>
            ) : loading && !calendar ? (
              <div className="px-6 py-16 text-center text-sm text-gray-400">
                Loading upcoming meetings…
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-blue-200/15 text-left">
                      <th scope="col" className="px-5 py-3.5 font-semibold text-gray-300">
                        <button
                          type="button"
                          onClick={() => toggleSort("date")}
                          className={`inline-flex items-center gap-1 transition-colors duration-300 hover:text-white ${
                            sort.column === "date" ? "text-white" : ""
                          }`}
                        >
                          Date
                          <span className="text-[10px] text-blue-300">
                            {sort.column === "date" ? (sort.dir === "asc" ? "▲" : "▼") : ""}
                          </span>
                        </button>
                      </th>
                      <th scope="col" className="px-5 py-3.5 font-semibold text-gray-300">
                        <button
                          type="button"
                          onClick={() => toggleSort("company")}
                          className={`inline-flex items-center gap-1 transition-colors duration-300 hover:text-white ${
                            sort.column === "company" ? "text-white" : ""
                          }`}
                        >
                          Company
                          <span className="text-[10px] text-blue-300">
                            {sort.column === "company" ? (sort.dir === "asc" ? "▲" : "▼") : ""}
                          </span>
                        </button>
                      </th>
                      <th scope="col" className="px-5 py-3.5 font-semibold text-gray-300">
                        Type
                      </th>
                      <th scope="col" className="px-5 py-3.5 font-semibold text-gray-300">
                        Time
                      </th>
                      <th scope="col" className="px-5 py-3.5 font-semibold text-gray-300">
                        City
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {meetings.map((meeting: CorporateMeeting) => (
                      <tr
                        key={`${meeting.symbol}-${meeting.date}-${meeting.meetingType}`}
                        className="border-b border-white/5 transition-colors duration-200 last:border-b-0 hover:bg-white/[0.04]"
                      >
                        <td className="whitespace-nowrap px-5 py-3 tabular-nums text-white">
                          {formatDate(meeting.date)}
                        </td>
                        <td className="px-5 py-3">
                          <span className="font-semibold text-white">
                            {meeting.companyName}
                          </span>
                          <span className="ml-2 text-xs tracking-wide text-gray-400">
                            {meeting.symbol}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span className="rounded-full border border-blue-300/25 bg-blue-400/10 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-blue-200">
                            {meeting.meetingType}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 tabular-nums text-gray-300">
                          {formatTime(meeting.time)}
                        </td>
                        <td className="px-5 py-3 text-gray-300">
                          {meeting.city ?? "—"}
                        </td>
                      </tr>
                    ))}
                    {meetings.length === 0 && calendar && (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-5 py-16 text-center text-sm text-gray-400"
                        >
                          No meetings match the current filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {calendar && (
            <p className="mt-5 text-xs text-gray-400 tabular-nums">
              {meetings.length} of {calendar.meetings.length} upcoming
              meetings · as reported to the Pakistan Stock Exchange
            </p>
          )}
        </div>
      </section>

      <Footer />
    </main>
  );
}
