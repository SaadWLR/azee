import { Reveal } from "./Reveal";

/**
 * #about — the credential wall.
 *
 * ONE FOCAL POINT: the firm's real, verifiable licences, set as
 * typography. Nothing here is decorative. Every figure on screen is
 * either a registration number AZEE actually holds or a span of years
 * computed from the real founding year.
 *
 * WHY NOT THE REGULATORS' LOGOS: the brief offered official PSX / SECP /
 * CDC / NCCPL marks as an option, on the condition that the real current
 * logos be used rather than approximations. Those assets are not in this
 * repo and I will not redraw or approximate a regulator's mark — a
 * wrong-looking official logo on a licensed broker's site is worse than
 * no logo. The brief's stated alternative is taken instead: the
 * registration numbers themselves, plus a dynamically computed years
 * figure, as the typographic anchor. Dropping in the real marks later is
 * a contained change to CREDENTIALS below.
 *
 * WHAT REPLACED THE OLD TREATMENT: six filled glass cards each with a
 * rounded icon tile — a generic icon-and-card grid, which the spec
 * forbids. The icons carried no information the heading did not already
 * carry, so they are gone rather than restyled.
 */

/** The year AZEE Securities was incorporated. The single source for the
 *  years figure below — never hardcode the span itself. */
const FOUNDED = 2003;

interface Credential {
  /** The identifier itself — the visual anchor of each entry. */
  value: string;
  /** What the identifier IS. */
  label: string;
  /** What it means for a client, in plain terms. */
  note: string;
}

/*
 * Real registrations, matching src/data/company.ts and the Footer. The
 * numbers are the visual: each is independently checkable against the
 * issuing body's own register.
 */
const CREDENTIALS: Credential[] = [
  {
    value: "108",
    label: "PSX TREC Holder",
    note: "Licensed trading rights on the Pakistan Stock Exchange — ready, futures and odd-lot markets.",
  },
  {
    value: "0041920",
    label: "SECP Registration",
    note: "Registered with the Securities & Exchange Commission of Pakistan, under its conduct and capital rules.",
  },
  {
    value: "04184",
    label: "CDC Participant",
    note: "Client securities sit in sub-accounts at the Central Depository Company, separate from house assets.",
  },
  {
    value: "C0418401",
    label: "NCCPL Participant",
    note: "Direct membership of the National Clearing Company, which settles every PSX trade.",
  },
];

export function WhyAzee() {
  // Computed, never written down: the figure is correct next year too.
  const years = new Date().getFullYear() - FOUNDED;

  return (
    <section
      id="about"
      className="relative bg-[rgb(var(--azee-ink))] py-28 lg:py-40"
    >
      {/* A single hairline, the section's only ornament. */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px bg-white/10"
      />

      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-12">
        {/* Centred, single column — no split layout. */}
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/40">
              Why AZEE Securities
            </p>
          </Reveal>

          <Reveal delay={100}>
            {/*
             * The one display-serif moment in this section. Colour is
             * --azee-chalk, a desaturated off-white — not pure white.
             */}
            <h2 className="font-display mt-8 text-[2.75rem] text-[rgb(var(--azee-chalk))] sm:text-6xl lg:text-7xl">
              {years} years,
              <br />
              fully accountable.
            </h2>
          </Reveal>

          <Reveal delay={200}>
            <p className="mx-auto mt-8 max-w-xl text-base leading-relaxed text-white/55">
              Every year since {FOUNDED}, under the same four regulators. These
              are the registrations that make that verifiable — each one
              checkable against the issuing body&apos;s own register.
            </p>
          </Reveal>
        </div>

        {/*
         * The credential wall. Outline-only on dark, large radius, no
         * fill and no shadow — the spec's alternative to the "filled
         * card pretending to be elevated" pattern this replaced.
         */}
        <div className="mt-20 grid grid-cols-1 gap-px overflow-hidden rounded-[28px] border border-white/12 sm:grid-cols-2">
          {CREDENTIALS.map((item, i) => (
            <Reveal key={item.label} delay={(i % 2) * 100}>
              <div className="h-full bg-[rgb(var(--azee-ink))] p-8 sm:p-10">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">
                  {item.label}
                </p>
                {/* The number is the visual. */}
                <p className="mt-4 text-4xl font-semibold tabular-nums tracking-tight text-[rgb(var(--azee-chalk))] sm:text-5xl">
                  {item.value}
                </p>
                <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/50">
                  {item.note}
                </p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={200}>
          <p className="mt-10 text-center text-xs leading-relaxed text-white/35">
            AZEE Securities (Pvt.) Ltd. — incorporated {FOUNDED}, Registration
            No. K-8159 (2000-1), Securities Broker Licence No.
            108/Securities&nbsp;Broker/2019.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
