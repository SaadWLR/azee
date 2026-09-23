import type {
  CompanyDetailResponse,
  CompanyFinancialTable,
  CompanyFootnote,
} from "../types/listed-company";

/**
 * Fundamentals and Profile on /market-watch/:symbol, from PSX's Data
 * Portal page for the symbol (one fetch, both sections).
 *
 * WHAT THESE SECTIONS DELIBERATELY DO NOT SHOW. The same PSX page also
 * carries a day range, a 52-week range, announcements and payouts.
 * This page already has all four, and takes them from the live
 * market-watch feed, from the EOD archive it computes its own range
 * from, and from the announcements endpoint. A second copy would
 * invite two figures to disagree in public — and for PRWM, PSX's own
 * 52-week low sat above 191 of the year's 220 closes in PSX's own
 * archive, so the two really can.
 *
 * EVERY FIGURE HERE IS PSX'S OWN STRING, not a reformatted one.
 * Parentheses mean negative because that is how PSX prints it, cells
 * PSX left blank are shown as an em dash rather than a zero, and no
 * row is padded to make a table look complete. The one exception is
 * market cap, which is converted from PSX's thousands to a compact
 * PKR figure and labelled as converted.
 */

/** A cell PSX left blank: said plainly, never filled with a zero. */
const BLANK = "—";

function compactPkr(thousands: string | null): string | null {
  if (!thousands) return null;
  const value = Number(thousands.replace(/,/g, "")) * 1000;
  if (!Number.isFinite(value) || value <= 0) return null;
  if (value >= 1e12) return `PKR ${(value / 1e12).toFixed(2)}tn`;
  if (value >= 1e9) return `PKR ${(value / 1e9).toFixed(2)}bn`;
  if (value >= 1e6) return `PKR ${(value / 1e6).toFixed(2)}m`;
  return `PKR ${value.toLocaleString("en-US")}`;
}

function Stat({
  label,
  value,
  markers,
  title,
}: {
  label: string;
  value: string | null;
  markers?: string[];
  title?: string;
}) {
  return (
    <div className="min-w-[8rem]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50">
        {label}
        {markers?.length ? (
          <span className="ml-1 text-blue-300/90">{markers.join("")}</span>
        ) : null}
      </p>
      <p
        className="mt-1 text-xl font-bold tabular-nums leading-none text-[rgb(var(--azee-chalk))]"
        title={title}
      >
        {value ?? <span className="text-white/45">Not published</span>}
      </p>
    </div>
  );
}

/**
 * One financial or ratio table.
 *
 * Column count comes from PSX: a company listed last year genuinely
 * has one annual column, and ratios can reach a year further back than
 * the financials do. Nothing here pads either to a fixed width.
 */
function FiguresTable({
  caption,
  table,
}: {
  caption: string;
  table: CompanyFinancialTable;
}) {
  return (
    <div className="mt-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50">
        {caption}
      </p>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[26rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="py-2 pr-4 text-left text-[11px] font-semibold uppercase tracking-wider text-white/45">
                {/* PSX's own corner cell is empty; this names the column
                    for anyone reading the table with a screen reader. */}
                <span className="sr-only">Line item</span>
              </th>
              {table.periods.map((period) => (
                <th
                  key={period}
                  className="py-2 pl-4 text-right text-[11px] font-semibold uppercase tracking-wider text-white/45"
                >
                  {period}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => (
              <tr key={row.label} className="border-b border-white/5 last:border-0">
                <th
                  scope="row"
                  className="py-2 pr-4 text-left text-xs font-medium text-gray-400"
                >
                  {row.label}
                </th>
                {row.values.map((value, i) => (
                  <td
                    key={table.periods[i]}
                    className={`py-2 pl-4 text-right text-sm tabular-nums ${
                      value === null
                        ? "text-white/30"
                        : value.startsWith("(")
                          ? "text-rose-400"
                          : "text-[rgb(var(--azee-chalk))]"
                    }`}
                    title={value === null ? "PSX published no figure here" : undefined}
                  >
                    {value ?? BLANK}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Footnotes({ footnotes }: { footnotes: CompanyFootnote[] }) {
  if (!footnotes.length) return null;
  return (
    <p className="mt-3 text-[11px] leading-relaxed text-white/45">
      {footnotes.map((f) => (
        <span key={f.marker} className="mr-3">
          <span className="text-blue-300/90">{f.marker}</span> {f.meaning}
        </span>
      ))}
    </p>
  );
}

const SECTION =
  "mt-6 rounded-2xl border border-white/12 bg-[rgb(var(--azee-panel))] px-6 py-5";
const HEADING = "text-sm font-semibold text-[rgb(var(--azee-chalk))]";

/**
 * Fundamentals: the equity figures, then the financial statements and
 * ratios, then Capital Stake's notice.
 *
 * The notice is placed with the tables and nowhere else, because it
 * covers those and not the profile or the equity figures, which are
 * PSX's own.
 */
export function FundamentalsSection({ detail }: { detail: CompanyDetailResponse }) {
  const f = detail.fundamentals;
  if (!f) return null;

  const hasTables = Boolean(f.annual || f.quarterly || f.ratios);
  const marketCap = compactPkr(f.marketCapThousands);

  return (
    <section className={SECTION}>
      <h2 className={HEADING}>Fundamentals</h2>
      <div className="mt-4 flex flex-wrap gap-x-10 gap-y-5">
        <Stat label="P/E Ratio (TTM)" value={f.peRatioTtm} markers={f.peFootnotes} />
        <Stat
          label="Market Cap"
          value={marketCap ?? f.marketCapThousands}
          title={
            f.marketCapThousands
              ? `PSX publishes this as ${f.marketCapThousands} thousand`
              : undefined
          }
        />
        <Stat label="Shares" value={f.shares} />
        <Stat label="Free Float" value={f.freeFloatShares} />
        {/* PSX publishes the free float twice, as a share count and as
            a percentage. The percentage only appears when PSX gives
            one; it is never derived from the two share counts here. */}
        {f.freeFloatPercent ? (
          <Stat label="Free Float %" value={f.freeFloatPercent} />
        ) : null}
      </div>
      <Footnotes footnotes={detail.footnotes} />

      {hasTables ? (
        <>
          {f.unitsNote ? (
            <p className="mt-5 text-[11px] leading-relaxed text-white/45">
              {f.unitsNote}. Figures in parentheses are negative, as PSX prints
              them; {BLANK} marks a period PSX published no figure for.
            </p>
          ) : null}
          {f.annual ? <FiguresTable caption="Financials — annual" table={f.annual} /> : null}
          {f.quarterly ? (
            <FiguresTable caption="Financials — quarterly" table={f.quarterly} />
          ) : null}
          {f.ratios ? <FiguresTable caption="Ratios" table={f.ratios} /> : null}
          {detail.attribution ? (
            <p className="mt-4 max-w-3xl text-[11px] leading-relaxed text-white/45">
              {detail.attribution}
            </p>
          ) : null}
        </>
      ) : (
        /* Said, not left blank: PSX serves this symbol's financials
           table with "No Data Available" in it, which is an answer. */
        <p className="mt-5 text-[11px] leading-relaxed text-white/45">
          PSX publishes no financial statements or ratios for {detail.symbol}.
        </p>
      )}
    </section>
  );
}

/** One labelled line of the profile, omitted when PSX has nothing. */
function ProfileField({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="min-w-[12rem] flex-1">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50">
        {label}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-gray-300">{value}</p>
    </div>
  );
}

/**
 * Profile: description, the people PSX names, and the corporate
 * details.
 *
 * A share class can carry the section with every field blank (ANLNV).
 * That says so in words rather than rendering an empty card, which a
 * reader would fairly read as a page that failed to load.
 */
export function ProfileSection({ detail }: { detail: CompanyDetailResponse }) {
  const p = detail.profile;
  if (!p) return null;

  return (
    <section className={SECTION}>
      <h2 className={HEADING}>Company profile</h2>
      {p.isEmpty ? (
        <p className="mt-2 text-[11px] leading-relaxed text-white/45">
          PSX lists {detail.symbol} but publishes no profile details for it —
          no description, people, address or auditor. Share classes listed
          separately from the parent company are often carried this way.
        </p>
      ) : (
        <>
          {p.description ? (
            <p className="mt-3 max-w-3xl text-xs leading-relaxed text-gray-300">
              {p.description}
            </p>
          ) : null}

          {p.keyPeople.length ? (
            <div className="mt-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50">
                Key people
              </p>
              <ul className="mt-2 divide-y divide-white/8">
                {p.keyPeople.map((person) => (
                  <li
                    key={`${person.name}-${person.role}`}
                    className="flex items-baseline gap-4 py-2"
                  >
                    <span className="min-w-0 flex-1 text-xs font-semibold text-[rgb(var(--azee-chalk))]">
                      {person.name}
                    </span>
                    <span className="shrink-0 text-xs text-gray-400">{person.role}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-x-10 gap-y-5">
            <ProfileField label="Address" value={p.address} />
            <ProfileField label="Registrar" value={p.registrar} />
            <ProfileField label="Auditor" value={p.auditor} />
            <ProfileField label="Fiscal year end" value={p.fiscalYearEnd} />
            {p.website ? (
              <div className="min-w-[12rem] flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50">
                  Website
                </p>
                <a
                  href={
                    p.website.startsWith("http") ? p.website : `https://${p.website}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block text-xs text-blue-300/90 transition-colors duration-300 hover:text-blue-200"
                >
                  {p.website}
                </a>
              </div>
            ) : null}
          </div>
        </>
      )}
      <p className="mt-4 text-[11px] leading-relaxed text-white/45">
        Source: Pakistan Stock Exchange Data Portal.
      </p>
    </section>
  );
}
