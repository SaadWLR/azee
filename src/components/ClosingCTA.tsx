import { Link } from "react-router-dom";
import { CLOSING_VIDEO_URL } from "../config";
import { useBackgroundVideo } from "../hooks/useBackgroundVideo";
import marketWatchPreview from "../assets/market-watch-preview.jpg";

/**
 * Homepage closing section — the conversion moment above the Footer.
 *
 * VIDEO DEMOTED, NOT REMOVED. The night-city footage used to be the
 * full-bleed background of this whole section. It is still here: same
 * asset, same URL, same muted autoplay loop, still using
 * useBackgroundVideo's retry/error handling. It now sits in a small
 * framed panel under the call to action instead of behind everything.
 *
 * PRIMARY VISUAL: a real screenshot of AZEE's own live Market Watch
 * page — the actual product, with its real column structure, real
 * PSX-listed companies, real sector names and real index-membership
 * badges. Checked directly against Robinhood, Wise, Fidelity and
 * Trading 212: in every case the dominant visual is something real,
 * most often a product screenshot, never decorative footage. The
 * homepage Hero keeps its full-bleed video precisely because it already
 * has a real anchor beside it (the live Market Snapshot panel); this
 * section had none, so the footage was doing the work alone.
 *
 * ON THE SCREENSHOT BEING A STILL: it is captured, dated and labelled
 * as an interface preview in the caption below it, and the caption says
 * where the live version lives. That matters on this site — a frozen
 * image of moving prices presented as current would be exactly the
 * fabricated-data problem this project refuses everywhere else. Shown
 * as a dated preview of the interface, it is an honest product shot.
 * Re-capture it when the Market Watch layout materially changes.
 */

/** When the preview image was captured, shown in its caption. */
const PREVIEW_CAPTURED = "20 Aug 2026";

export function ClosingCTA() {
  const { videoRef, onError } = useBackgroundVideo();

  return (
    <section className="relative w-full overflow-hidden bg-black py-24 sm:py-28">
      {/* Static navy bloom — the ambient tone the full-bleed footage
          used to carry, now at a fraction of its visual weight. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(ellipse_75%_60%_at_50%_40%,rgb(var(--azee-navy)/0.7),transparent_72%)]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-300/25 to-transparent"
      />

      <div className="relative z-10 mx-auto grid w-full max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,34rem)] lg:gap-16 lg:px-12">
        {/* ── Copy, CTA, and the demoted video ───────────────────── */}
        <div>
          <p
            className="closing-fade-up text-xs font-semibold uppercase tracking-[0.25em] text-blue-300/90"
            style={{ animationDelay: "0.1s" }}
          >
            Start investing
          </p>

          <h2 className="mt-5 text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">
            <span className="closing-fade-up block" style={{ animationDelay: "0.25s" }}>
              The market's live.
            </span>
            <span className="closing-fade-up block" style={{ animationDelay: "0.4s" }}>
              Make your move.
            </span>
          </h2>

          <p
            className="closing-fade-up mt-6 max-w-xl text-base leading-relaxed text-gray-300 sm:text-lg"
            style={{ animationDelay: "0.55s" }}
          >
            Live PSX prices, market research, and order execution — the full
            picture, and the tools to act on it, in a single AZEE account.
          </p>

          <div
            className="closing-fade-up mt-9"
            style={{ animationDelay: "0.7s" }}
          >
            <Link
              to="/get-started"
              className="closing-glass inline-block rounded-full px-9 py-4 text-center text-[15px] font-semibold text-white transition-transform duration-300 hover:scale-[1.04] active:scale-[0.98]"
            >
              Open a Trading Account
            </Link>
          </div>

          {/*
           * The night-city footage, kept — now a small supporting panel
           * rather than the section's background. Decorative, so it is
           * aria-hidden: every word of meaning here is in the type above
           * and the product shot beside it.
           */}
          <div
            className="closing-fade-up mt-10 w-full max-w-[15rem] overflow-hidden rounded-2xl border border-white/10 shadow-[0_16px_40px_rgba(0,0,0,0.5)]"
            style={{ animationDelay: "0.9s" }}
            aria-hidden="true"
          >
            <div className="relative aspect-video">
              <video
                ref={videoRef}
                className="h-full w-full object-cover"
                src={CLOSING_VIDEO_URL}
                onError={onError}
                autoPlay
                muted
                loop
                playsInline
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-[linear-gradient(to_top,rgb(var(--azee-navy)/0.45),transparent_65%)]"
              />
            </div>
          </div>
        </div>

        {/* ── PRIMARY: the real product ──────────────────────────── */}
        <figure
          className="closing-fade-up m-0"
          style={{ animationDelay: "0.45s" }}
        >
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-black shadow-[0_32px_80px_rgba(0,0,0,0.6)]">
            <img
              src={marketWatchPreview}
              width={1184}
              height={460}
              loading="lazy"
              decoding="async"
              alt="AZEE Market Watch showing live PSX quotes — symbol, company name, sector, price, change and volume for each listed company."
              className="block w-full"
            />
            {/* The capture ends mid-row; fading the cut edge reads as a
                deliberate crop rather than a truncated screenshot. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black to-transparent"
            />
          </div>
          <figcaption className="mt-4 text-xs leading-relaxed text-gray-500">
            AZEE Market Watch — interface preview captured {PREVIEW_CAPTURED}.
            Prices shown were live at capture;{" "}
            <Link
              to="/market-watch"
              className="text-gray-400 underline decoration-white/20 underline-offset-4 transition-colors duration-300 hover:text-white hover:decoration-white/50"
            >
              open Market Watch
            </Link>{" "}
            for current quotes.
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
