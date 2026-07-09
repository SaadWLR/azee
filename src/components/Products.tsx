import type { ComponentType, SVGProps } from "react";
import { Reveal } from "./Reveal";
import { SectionHeading } from "./SectionHeading";
import {
  IconCandles,
  IconCompass,
  IconIngots,
  IconPie,
  IconResearch,
  IconRocket,
} from "./Icons";

interface Product {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  text: string;
}

const PRODUCTS: Product[] = [
  {
    icon: IconCandles,
    title: "Equity Trading",
    text: "Trade PSX-listed shares in the ready and futures markets with real-time quotes, fast order routing, and margin facilities on eligible symbols.",
  },
  {
    icon: IconIngots,
    title: "PMEX Commodities",
    text: "Gold, silver, crude oil, and currency futures on the Pakistan Mercantile Exchange — hedge or trade with exchange-cleared contracts.",
  },
  {
    icon: IconRocket,
    title: "IPO Investment",
    text: "Subscribe to new listings in the PSX primary market, with book-building coverage and listing-day analysis from our research desk.",
  },
  {
    icon: IconPie,
    title: "Mutual Funds",
    text: "Access diversified funds and ETFs across equity, income, and money-market categories to complement direct shareholdings.",
  },
  {
    icon: IconResearch,
    title: "Market Research",
    text: "Daily notes, sector studies, and company reports — fundamental and technical views prepared for serious investors.",
  },
  {
    icon: IconCompass,
    title: "Portfolio Advisory",
    text: "Structured guidance aligned to your objectives and risk appetite, from first account to long-horizon portfolio construction.",
  },
];

export function Products() {
  return (
    <section id="products" className="section-tint-b relative overflow-hidden py-24 lg:py-32">
      {/* Soft top divider glow */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-300/25 to-transparent"
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-12">
        <SectionHeading
          eyebrow="Products & Services"
          title="Every market, one relationship."
          description="Equities, commodities, primary-market offerings, and managed products — executed and researched under one regulated roof."
        />

        <div className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {PRODUCTS.map((product, i) => (
            <Reveal key={product.title} delay={(i % 3) * 100}>
              <a
                href="#"
                className="liquid-glass glass-sheen card-glow group flex h-full flex-col rounded-3xl p-8 hover:bg-white/[0.12]"
              >
                <div className="flex items-start justify-between">
                  <div className="liquid-glass flex h-12 w-12 items-center justify-center rounded-2xl text-white transition-transform duration-500 group-hover:scale-110">
                    <product.icon className="h-6 w-6" />
                  </div>
                  <span className="text-sm font-medium text-gray-300/60 tabular-nums">
                    0{i + 1}
                  </span>
                </div>
                <h3 className="mt-6 text-xl font-semibold tracking-tight text-white">
                  {product.title}
                </h3>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-gray-400">
                  {product.text}
                </p>
                <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-white/80 transition-all duration-500 group-hover:gap-3 group-hover:text-white">
                  Explore
                  <span aria-hidden="true">→</span>
                </span>
              </a>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
