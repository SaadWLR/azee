import { FadeIn } from "./FadeIn";
import { useTickerQuotes } from "../hooks/useMarketData";
import type { StockQuote } from "../types";

function TickerItem({ quote }: { quote: StockQuote }) {
  const up = quote.changePercent >= 0;
  return (
    <span className="flex items-center gap-2.5 rounded-full px-7 py-0.5 transition-colors duration-500 hover:bg-white/5">
      <span className="text-xs font-semibold tracking-wide text-white/90">
        {quote.symbol}
      </span>
      <span className="text-xs text-gray-400 tabular-nums">
        {quote.price.toLocaleString("en-US", { minimumFractionDigits: 2 })}
      </span>
      <span
        className={`text-xs font-medium tabular-nums ${
          up ? "text-emerald-300" : "text-rose-300"
        }`}
      >
        {up ? "▲" : "▼"} {up ? "+" : ""}
        {quote.changePercent.toFixed(2)}%
      </span>
    </span>
  );
}

export function TickerTape() {
  const { data: quotes } = useTickerQuotes();

  return (
    <FadeIn delay={1700}>
      <div className="ticker-mask overflow-hidden border-y border-blue-200/10 bg-[#0a1226]/60 py-1.5">
        <div className="ticker-track flex w-max">
          {/* Track is duplicated so the loop is seamless. */}
          {[0, 1].map((copy) => (
            <div key={copy} className="flex" aria-hidden={copy === 1}>
              {(quotes ?? []).map((quote) => (
                <TickerItem key={`${copy}-${quote.symbol}`} quote={quote} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </FadeIn>
  );
}
