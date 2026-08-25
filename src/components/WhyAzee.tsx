import { Reveal } from "./Reveal";

/**
 * #about — the credential seal stack.
 *
 * ONE FOCAL POINT: AZEE's four real registrations as a physical object.
 * Each licence sits on its own card, rotated and depth-shadowed, fanned
 * into a stack — the way the paper certificates themselves would sit on
 * a desk. It replaced a 2×4 grid inside one large empty bordered box,
 * which was a container, not a composition.
 *
 * Everything on the cards is real and independently checkable: PSX TREC
 * 108, SECP 0041920, CDC 04184, NCCPL C0418401. The years figure is
 * COMPUTED from the 2003 founding year, never typed.
 *
 * DIMENSIONALITY IS REAL, NOT IMPLIED. Each card carries its own
 * rotation and its own long shadow, and they overlap — so the depth
 * comes from the arrangement itself rather than from a border pretending
 * to be an edge.
 *
 * MOBILE IS A DIFFERENT COMPOSITION, not this one scaled. A four-card
 * fan needs horizontal room it does not have on a phone; shrunk down it
 * becomes an unreadable overlap. Below `sm` the cards straighten out
 * into an offset cascade — still layered and still overlapping top to
 * bottom, but each one legible on its own line.
 */

/** The year AZEE Securities was incorporated — the single source for
 *  the years figure below. Never hardcode the span itself. */
const FOUNDED = 2003;

interface Credential {
  value: string;
  label: string;
  issuer: string;
  note: string;
  /** Desktop fan geometry: rotation, offsets and stacking order. */
  fan: string;
  /** Mobile cascade geometry — a gentler, vertical arrangement. */
  cascade: string;
}

/*
 * Real registrations, matching src/data/company.ts and the Footer.
 * Ordered front-to-back: the exchange licence reads first because it is
 * the one that lets AZEE trade at all.
 */
const CREDENTIALS: Credential[] = [
  {
    value: "No. 108",
    label: "PSX TREC Holder",
    issuer: "Pakistan Stock Exchange",
    note: "Licensed trading rights — ready, futures and odd-lot markets.",
    fan: "z-40 lg:left-[3%] lg:top-0 lg:-rotate-[5deg]",
    cascade: "z-40 -rotate-[2.5deg]",
  },
  {
    value: "0041920",
    label: "SECP Registration",
    issuer: "Securities & Exchange Commission",
    note: "Registered under the Commission's conduct and capital rules.",
    fan: "z-30 lg:left-[15%] lg:top-[25%] lg:rotate-[3.5deg]",
    cascade: "z-30 rotate-[2deg]",
  },
  {
    value: "04184",
    label: "CDC Participant",
    issuer: "Central Depository Company",
    note: "Client securities held in sub-accounts, separate from house assets.",
    fan: "z-20 lg:left-[2%] lg:top-[50%] lg:-rotate-[3deg]",
    cascade: "z-20 -rotate-[1.5deg]",
  },
  {
    value: "C0418401",
    label: "NCCPL Participant",
    issuer: "National Clearing Company",
    note: "Direct membership of the company that settles every PSX trade.",
    fan: "z-10 lg:left-[13%] lg:top-[75%] lg:rotate-[2.5deg]",
    cascade: "z-10 rotate-[1deg]",
  },
];

function SealCard({ item }: { item: Credential }) {
  return (
    <div className="rounded-[22px] border border-[rgb(var(--azee-blue)/0.22)] bg-[rgb(var(--azee-panel))] px-7 py-6 shadow-[0_28px_60px_-12px_rgba(3,6,20,0.9)]">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[rgb(var(--azee-orange))]">
        {item.label}
      </p>
      {/* Level 4 — the datum. Serif, because this is the object's face. */}
      <p className="font-display mt-3 text-[1.75rem] leading-none text-[rgb(var(--azee-chalk))]">
        {item.value}
      </p>
      {/* Level 5 — metadata. */}
      <p className="mt-2.5 text-xs text-white/65">{item.issuer}</p>
      <p className="mt-4 max-w-[17rem] text-xs leading-relaxed text-white/60">
        {item.note}
      </p>
    </div>
  );
}

export function WhyAzee() {
  const years = new Date().getFullYear() - FOUNDED;

  return (
    <section
      id="about"
      className="relative bg-[rgb(var(--azee-navy))] py-32 lg:py-48"
    >
      {/*
       * HERO → ABOUT BLEND.
       *
       * Its job changed when this section became navy. The two grounds
       * now MATCH — the hero's floor settles into --azee-navy and this
       * section is that navy — so the colour seam the band was built to
       * hide no longer exists.
       *
       * What is still there is a TEXTURE seam: above the line is video,
       * grained and moving, and below it is flat colour. The band now
       * covers that instead, carrying the same --azee-blue lift the
       * globe is rim-lit in down over the join and easing it out into
       * the flat ground. Same purpose as before — the two sections read
       * as one descent — against the difference that actually remains.
       *
       * A gradient with meaning rather than an ambient wash, and
       * data-hero-blend still marks it as the one sanctioned gradient
       * here; the design spec asserts every OTHER gradient in these
       * sections is forbidden.
       */}
      <div
        data-hero-blend="true"
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[26rem] bg-[linear-gradient(to_bottom,rgb(var(--azee-navy))_0%,rgb(var(--azee-blue)/0.18)_22%,rgb(var(--azee-blue)/0.07)_52%,transparent_100%)]"
      />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-12">
        <div className="grid items-center gap-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-16">
          {/* ── Copy ──────────────────────────────────────────────── */}
          <div>
            {/* Level 5 — metadata */}
            <Reveal>
              <p className="eyebrow">Why AZEE Securities</p>
            </Reveal>

            {/* Level 1 — the hero statement */}
            <Reveal delay={100}>
              <h2 className="font-display mt-10 text-[3rem] text-[rgb(var(--azee-chalk))] sm:text-[4rem] lg:text-[4.5rem]">
                {years} years.
                <br />
                Fully accountable.
              </h2>
            </Reveal>

            {/* Level 3 — the supporting line */}
            <Reveal delay={200}>
              <p className="mt-10 max-w-md text-[15px] leading-[1.75] text-white/50">
                Every year since {FOUNDED}, under the same four regulators —
                each registration independently checkable against its issuing
                register.
              </p>
            </Reveal>

            <Reveal delay={280}>
              <p className="mt-12 max-w-md text-xs leading-relaxed text-white/55">
                AZEE Securities (Pvt.) Ltd. — incorporated {FOUNDED},
                Registration No. K-8159 (2000-1), Securities Broker Licence
                No. 108/Securities&nbsp;Broker/2019.
              </p>
            </Reveal>
          </div>

          {/* ── The seal stack ────────────────────────────────────── */}
          <Reveal delay={150}>
            {/*
             * Desktop: absolutely-positioned fan inside a fixed-height
             * stage. Mobile: a relative offset cascade, where each card
             * pulls up under the one before it — a different
             * arrangement, not the fan shrunk.
             */}
            <div className="relative mx-auto w-full max-w-sm lg:h-[40rem] lg:max-w-none">
              {CREDENTIALS.map((item, i) => (
                <div
                  key={item.label}
                  className={`${item.cascade} ${item.fan} relative w-full lg:absolute lg:w-[21rem] ${
                    i > 0 ? "-mt-6 lg:mt-0" : ""
                  }`}
                >
                  <SealCard item={item} />
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
