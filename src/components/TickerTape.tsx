import { FadeIn } from "./FadeIn";
import { TICKER_QUOTES, type TickerQuote } from "../data/marketData";

function TickerItem({ quote }: { quote: TickerQuote }) {
  const up = quote.changePercent >= 0;
  return (
    <span className="flex items-center gap-2 px-6">
      <span className="text-xs font-semibold tracking-wide text-white/90">
        {quote.symbol}
      </span>
      <span className="text-xs text-gray-300 tabular-nums">
        {quote.price.toLocaleString("en-US", { minimumFractionDigits: 2 })}
      </span>
      <span
        className={`text-xs font-medium tabular-nums ${
          up ? "text-emerald-400" : "text-red-400"
        }`}
      >
        {up ? "▲" : "▼"} {up ? "+" : ""}
        {quote.changePercent.toFixed(2)}%
      </span>
    </span>
  );
}

export function TickerTape() {
  return (
    <FadeIn delay={1700}>
      <div className="ticker-mask overflow-hidden border-y border-white/10 bg-black/30 py-2">
        <div className="ticker-track flex w-max">
          {/* Track is duplicated so the loop is seamless. */}
          {[0, 1].map((copy) => (
            <div key={copy} className="flex" aria-hidden={copy === 1}>
              {TICKER_QUOTES.map((quote) => (
                <TickerItem key={`${copy}-${quote.symbol}`} quote={quote} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </FadeIn>
  );
}
