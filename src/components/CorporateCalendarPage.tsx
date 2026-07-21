import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { useCorporateCalendar, usePayouts } from "../hooks/useCalendar";
import { usePageMeta } from "../hooks/usePageMeta";
import type { CorporateMeeting } from "../types";
import type { Payout, PayoutKind } from "../types/payouts";

/*
 * Corporate Calendar — two views over PSX corporate actions:
 *   • Meetings: upcoming AGM/EOGM notices
 *   • Payouts:  recent dividend / bonus / rights announcements
 * Both are sortable/filterable lists reusing the Market Watch table
 * pattern rather than a calendar-grid widget, per the project's
 * preference for extending established patterns. Every entry is real
 * PSX-reported data; nothing is fabricated.
 */

type Tab = "meetings" | "payouts";

const TABS: { id: Tab; label: string }[] = [
  { id: "meetings", label: "Meetings" },
  { id: "payouts", label: "Payouts" },
];

const TAB_INTRO: Record<Tab, string> = {
  meetings:
    "Upcoming AGM and EOGM meetings of PSX-listed companies over the next 90 days — dates, times, and venues as reported to the Pakistan Stock Exchange.",
  payouts:
    "Recent dividend, bonus, and rights announcements from PSX-listed companies — shown exactly as the company reported them, with book closure dates where set.",
};

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

/* ── Meetings view (unchanged behavior) ───────────────────────── */

type TypeFilter = "all" | "AGM" | "EOGM";
type SortColumn = "date" | "company";
type SortDir = "asc" | "desc";

const TYPE_FILTERS: { id: TypeFilter; label: string }[] = [
  { id: "all", label: "All Meetings" },
  { id: "AGM", label: "AGM" },
  { id: "EOGM", label: "EOGM" },
];

function MeetingsView() {
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
    <>
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
    </>
  );
}

/* ── Payouts view ─────────────────────────────────────────────── */

type KindFilter = "all" | PayoutKind;

const KIND_FILTERS: { id: KindFilter; label: string }[] = [
  { id: "all", label: "All Payouts" },
  { id: "dividend", label: "Dividend" },
  { id: "bonus", label: "Bonus" },
  { id: "rights", label: "Rights" },
];

const KIND_LABEL: Record<PayoutKind, string> = {
  dividend: "Dividend",
  bonus: "Bonus",
  rights: "Rights",
};

/** Badge styling per instrument, using only the established palette. */
const KIND_BADGE: Record<PayoutKind, string> = {
  dividend: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  bonus: "border-blue-300/25 bg-blue-400/10 text-blue-200",
  rights: "border-white/20 bg-white/10 text-gray-200",
};

/** Short form for book-closure dates: "27 Jul 2026". */
function formatShortDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Book closure window. Not every announcement carries one (rights
 * issues frequently don't), so absence renders as an em dash rather
 * than an invented date.
 */
function formatBookClosure(payout: Payout): string {
  if (!payout.bookClosureFrom) return "—";
  const from = formatShortDate(payout.bookClosureFrom);
  if (!payout.bookClosureTo || payout.bookClosureTo === payout.bookClosureFrom) {
    return from;
  }
  return `${from} – ${formatShortDate(payout.bookClosureTo)}`;
}

function PayoutsView() {
  const { data, loading, error } = usePayouts();
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [search, setSearch] = useState("");
  /*
   * Newest first — the same order the API already returns. Sorting
   * descending by announcedAt reproduces that order exactly (JS sort
   * is stable, so same-timestamp entries keep PSX's own sequence);
   * the header only lets the reader flip it.
   */
  const [dir, setDir] = useState<SortDir>("desc");

  const payouts = useMemo(() => {
    let rows = data?.payouts ?? [];
    if (kindFilter !== "all") {
      // A compound announcement can name more than one instrument, so
      // it legitimately appears under each kind it contains rather
      // than being forced into a single "primary" bucket.
      rows = rows.filter((p) => p.kinds.includes(kindFilter));
    }
    const term = search.trim().toUpperCase();
    if (term) {
      rows = rows.filter(
        (p) =>
          p.symbol.includes(term) || p.companyName.toUpperCase().includes(term),
      );
    }
    const factor = dir === "desc" ? -1 : 1;
    return [...rows].sort(
      (a, b) => factor * a.announcedAt.localeCompare(b.announcedAt),
    );
  }, [data, kindFilter, search, dir]);

  return (
    <>
      {/* Controls */}
      <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {KIND_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setKindFilter(f.id)}
              className={`rounded-full px-4 py-2 text-xs font-semibold transition-all duration-300 ${
                kindFilter === f.id
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
        {error && !data ? (
          <div className="px-6 py-16 text-center text-sm text-gray-400">
            Payout announcements are temporarily unavailable. Please try again
            shortly.
          </div>
        ) : loading && !data ? (
          <div className="px-6 py-16 text-center text-sm text-gray-400">
            Loading recent payout announcements…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-blue-200/15 text-left">
                  <th scope="col" className="px-5 py-3.5 font-semibold text-gray-300">
                    <button
                      type="button"
                      onClick={() => setDir((d) => (d === "asc" ? "desc" : "asc"))}
                      className="inline-flex items-center gap-1 text-white transition-colors duration-300 hover:text-white"
                    >
                      Announced
                      <span className="text-[10px] text-blue-300">
                        {dir === "asc" ? "▲" : "▼"}
                      </span>
                    </button>
                  </th>
                  <th scope="col" className="px-5 py-3.5 font-semibold text-gray-300">
                    Company
                  </th>
                  <th scope="col" className="px-5 py-3.5 font-semibold text-gray-300">
                    Announcement
                  </th>
                  <th scope="col" className="px-5 py-3.5 font-semibold text-gray-300">
                    Type
                  </th>
                  <th scope="col" className="px-5 py-3.5 font-semibold text-gray-300">
                    Book Closure
                  </th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((payout: Payout) => (
                  <tr
                    key={`${payout.symbol}-${payout.announcedAt}-${payout.announcement}`}
                    className="border-b border-white/5 transition-colors duration-200 last:border-b-0 hover:bg-white/[0.04]"
                  >
                    <td className="whitespace-nowrap px-5 py-3 tabular-nums text-white">
                      {formatShortDate(payout.announcedAt.slice(0, 10))}
                    </td>
                    <td className="px-5 py-3">
                      <span className="font-semibold text-white">
                        {payout.companyName}
                      </span>
                      <span className="ml-2 text-xs tracking-wide text-gray-400">
                        {payout.symbol}
                      </span>
                    </td>
                    {/*
                     * PSX's verbatim text is the primary display: it
                     * carries nuance (compound payouts, premium/discount
                     * rights terms) that a single derived percentage
                     * would misrepresent, so no percentage is rendered
                     * separately and none is ever computed.
                     */}
                    <td className="px-5 py-3 font-medium text-white">
                      {payout.announcement}
                    </td>
                    <td className="px-5 py-3">
                      <span className="flex flex-wrap gap-1.5">
                        {payout.kinds.map((kind) => (
                          <span
                            key={kind}
                            className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${KIND_BADGE[kind]}`}
                          >
                            {KIND_LABEL[kind]}
                          </span>
                        ))}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-gray-300">
                      {formatBookClosure(payout)}
                    </td>
                  </tr>
                ))}
                {payouts.length === 0 && data && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-5 py-16 text-center text-sm text-gray-400"
                    >
                      No payouts match the current filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {data && (
        <p className="mt-5 text-xs text-gray-400 tabular-nums">
          {payouts.length} of {data.payouts.length} recent announcements ·
          as reported to the Pakistan Stock Exchange
        </p>
      )}
    </>
  );
}

/* ── Page ─────────────────────────────────────────────────────── */

export function CorporateCalendarPage() {
  usePageMeta(
    "Corporate Calendar — PSX AGM/EOGM Meetings & Payouts | AZEE Trade",
    "Upcoming AGM and EOGM meetings of PSX-listed companies, plus recent dividend, bonus, and rights announcements — as reported to the Pakistan Stock Exchange.",
  );
  /*
   * Tab lives in the URL (?tab=payouts) so a view can be linked and
   * shared, and browser back/forward moves between them. Meetings is
   * the default, so the existing nav/footer links land where they
   * always have. Changing only the query string leaves pathname and
   * hash untouched, so the router's ScrollToHash does not fire.
   */
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: Tab = searchParams.get("tab") === "payouts" ? "payouts" : "meetings";

  function selectTab(next: Tab) {
    if (next === "meetings") {
      searchParams.delete("tab");
      setSearchParams(searchParams, { replace: true });
      return;
    }
    searchParams.set("tab", next);
    setSearchParams(searchParams, { replace: true });
  }

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
          {/* Brand-signature stripe — same motif as the hero headline
              (mt-4 sits it under this page's more compact heading). */}
          <div className="mt-4 h-[3px] w-16 rounded-full bg-gradient-to-r from-[rgb(var(--azee-orange))] to-[rgb(var(--azee-orange)/0)]" />
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gray-400 sm:text-base">
            {TAB_INTRO[tab]}
          </p>

          {/* Tabs */}
          <div
            role="tablist"
            aria-label="Corporate calendar views"
            className="mt-7 flex gap-6 border-b border-white/10"
          >
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => selectTab(t.id)}
                className={`relative -mb-px border-b-2 pb-3 text-sm font-semibold transition-colors duration-300 ${
                  tab === t.id
                    ? "border-blue-400 text-white"
                    : "border-transparent text-gray-400 hover:text-white"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "meetings" ? <MeetingsView /> : <PayoutsView />}
        </div>
      </section>

      <Footer />
    </main>
  );
}
