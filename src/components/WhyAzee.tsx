import type { ComponentType, SVGProps } from "react";
import { Reveal } from "./Reveal";
import { SectionHeading } from "./SectionHeading";
import {
  IconBadgeCheck,
  IconLandmark,
  IconResearch,
  IconShieldCheck,
  IconTrendBars,
  IconVault,
} from "./Icons";

interface Highlight {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  text: string;
}

const HIGHLIGHTS: Highlight[] = [
  {
    icon: IconLandmark,
    title: "20+ Years in Capital Markets",
    text: "Serving investors on Pakistan's exchanges since 2003 — through bull runs, drawdowns, and every market cycle in between.",
  },
  {
    icon: IconBadgeCheck,
    title: "PSX TREC Holder No. 108",
    text: "Licensed trading rights on the Pakistan Stock Exchange, with direct access to the ready, futures, and odd-lot markets.",
  },
  {
    icon: IconShieldCheck,
    title: "SECP Regulated",
    text: "Registered with the Securities & Exchange Commission of Pakistan (Reg. No. 0041920) and subject to its conduct and capital rules.",
  },
  {
    icon: IconVault,
    title: "CDC Participant",
    text: "Client securities are held in sub-accounts at the Central Depository Company (Participant ID 04184), separate from house assets.",
  },
  {
    icon: IconTrendBars,
    title: "PMEX Trading",
    text: "Commodity futures on the Pakistan Mercantile Exchange — gold, silver, crude oil, and currency contracts on one platform.",
  },
  {
    icon: IconResearch,
    title: "Professional Research Team",
    text: "Fundamental and technical coverage across PSX sectors, from daily market notes to in-depth company reports.",
  },
];

export function WhyAzee() {
  return (
    <section className="relative bg-black py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-12">
        <SectionHeading
          eyebrow="Why AZEE Securities"
          title="A regulated brokerage, built on two decades of market discipline."
          description="Credentials that matter when your capital is on the line — licensed, regulated, and researched from Karachi's financial district."
        />

        <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {HIGHLIGHTS.map((item, i) => (
            <Reveal key={item.title} delay={(i % 3) * 100}>
              <div className="liquid-glass glass-sheen group h-full rounded-3xl p-7 transition-all duration-500 hover:-translate-y-1.5 hover:bg-white/[0.14] hover:shadow-[0_20px_48px_rgba(0,0,0,0.45)]">
                <div className="liquid-glass flex h-12 w-12 items-center justify-center rounded-2xl text-white transition-transform duration-500 group-hover:scale-110">
                  <item.icon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-semibold tracking-tight text-white">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-300">
                  {item.text}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
