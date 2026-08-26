import { type MouseEvent } from "react";
import { Link } from "react-router-dom";
import { AnimatedHeading } from "./AnimatedHeading";
import { FadeIn } from "./FadeIn";
import { MarketPulseGauge } from "./MarketPulseGauge";
import { MarketSnapshot } from "./MarketSnapshot";
import { TickerTape } from "./TickerTape";
import { TrustBadges } from "./TrustBadges";
import { HERO_VIDEO_URL } from "../config";
import { useBackgroundVideo } from "../hooks/useBackgroundVideo";

/** Deterministic particle field — subtle drifting points of light. */
const PARTICLES = [
  { left: "8%", size: 3, duration: 22, delay: 0 },
  { left: "18%", size: 2, duration: 28, delay: 6 },
  { left: "29%", size: 2, duration: 24, delay: 12 },
  { left: "41%", size: 3, duration: 30, delay: 3 },
  { left: "53%", size: 2, duration: 26, delay: 9 },
  { left: "64%", size: 2, duration: 23, delay: 15 },
  { left: "76%", size: 3, duration: 29, delay: 5 },
  { left: "88%", size: 2, duration: 25, delay: 11 },
];

export function Hero() {
  const { videoRef, onError } = useBackgroundVideo();

  // Soft parallax: the video is slightly over-scaled and drifts a few
  // pixels against the cursor.
  const handleMouseMove = (event: MouseEvent<HTMLElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const x = (event.clientX / window.innerWidth - 0.5) * 12;
    const y = (event.clientY / window.innerHeight - 0.5) * 8;
    video.style.transform = `scale(1.06) translate(${-x}px, ${-y}px)`;
  };

  /*
   * The hero is a flex column in normal document flow: a spacer the
   * exact height of the fixed navbar, the ticker, then the content
   * stack centered in the remaining space. That stack is the
   * headline/snapshot row followed by the Market Pulse band, centred
   * together (justify-center on the stack) rather than the row
   * centring itself. min-h-screen fills the first viewport but never
   * locks it — taller content simply extends the page and scrolls.
   */
  return (
    <section
      id="markets"
      /*
       * The nav gets its own treatment over this section — a blue-black
       * darker than the navy the sections below use, because the hero
       * is black footage rather than a section colour. Same opt-in
       * mechanism the white sections use for their light theme.
       */
      data-nav-theme-section="hero"
      className="relative flex min-h-screen w-full flex-col overflow-hidden bg-black"
      onMouseMove={handleMouseMove}
    >
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 ease-out"
        style={{ transform: "scale(1.06)" }}
        src={HERO_VIDEO_URL}
        onError={onError}
        autoPlay
        muted
        loop
        playsInline
      />

      {/* Subtle blue rim light over the globe */}
      <div aria-hidden="true" className="globe-rim absolute inset-0" />

      {/* Soft dark gradient for text contrast over the footage */}
      <div
        aria-hidden="true"
        /*
         * BLACK-DOMINANT, WITH THE BLUE COMPRESSED INTO THE HANDOFF.
         *
         * This scrim used to hold --azee-navy at 0.92 all the way up
         * through 28% of the hero's height, which put saturated blue
         * across the whole lower third — the hero read as a blue
         * section rather than a black one with blue light in it.
         *
         * The navy now lives only in the bottom eighth, where it still
         * has a job to do: #about's ground is that same navy, and the
         * blend band there starts from it, so the two sections must
         * meet on the same colour or the seam comes back. Above that
         * handoff the scrim is plain black, so the blue in the hero
         * comes from the globe's rim light and the snapshot's backlight
         * — actual light in the scene — rather than from a wash laid
         * over the footage.
         *
         * The video itself is untouched; this is the overlay that has
         * always sat above it.
         */
        className="absolute inset-x-0 bottom-0 h-2/3 bg-[linear-gradient(to_top,rgb(var(--azee-navy)/0.95),rgb(var(--azee-navy)/0.42)_12%,rgb(0_0_0/0.58)_30%,rgb(0_0_0/0.18)_62%,transparent_100%)]"
      />

      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        {PARTICLES.map((p, i) => (
          <span
            key={i}
            className="particle"
            style={{
              left: p.left,
              bottom: "-2%",
              width: `${p.size}px`,
              height: `${p.size}px`,
              animationDuration: `${p.duration}s`,
              animationDelay: `${p.delay}s`,
            }}
          />
        ))}
      </div>

      {/* Flow spacer matching the fixed navbar's measured height. */}
      <div aria-hidden="true" style={{ height: "var(--nav-height)" }} />

      <div className="relative z-20 mt-2">
        <TickerTape />
      </div>

      <div className="relative z-10 flex w-full flex-1 flex-col justify-center gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:gap-14 lg:px-12 lg:py-20">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-start justify-between gap-10 lg:gap-12 xl:flex-row">
          <div className="w-full max-w-3xl lg:max-w-4xl">
            <AnimatedHeading
              lines={["Market intelligence.", "Real-time execution."]}
              baseDelay={300}
              charStagger={30}
              className="font-display text-[3rem] text-[rgb(var(--azee-chalk))] sm:text-[4rem] lg:text-[4.5rem]"
            />

            {/* Brand signature: a single orange stripe echoing the logo
                mark's own orange slash — the one warm note on the first
                screen, and now the same solid bar the section eyebrows
                below use. It used to fade out to transparent across its
                own 64px, which left perhaps 30px of actual colour on a
                black field; a mark that thin is a texture, not an
                accent. Solid and wider, it reads as the deliberate
                brand note it was always meant to be. */}
            <FadeIn delay={900}>
              <div className="mt-6 h-1 w-24 rounded-full bg-[rgb(var(--azee-orange))]" />
            </FadeIn>

            <FadeIn delay={1000}>
              <p className="mt-7 max-w-xl text-base leading-relaxed text-gray-300 sm:text-lg">
                AZEE Securities connects investors to the Pakistan Stock
                Exchange — equity research, live market data, and disciplined
                order execution across PSX and PMEX since 2003.
              </p>
            </FadeIn>

            <FadeIn delay={1200}>
              <div className="mt-10 flex flex-col items-stretch gap-4 sm:flex-row sm:flex-wrap sm:items-center">
                {/* Both were dead href="#". The primary CTA now reaches
                    the honest interim onboarding page; "View Research"
                    reaches the homepage's own Research section, which
                    already carries the live feed. */}
                <Link
                  to="/get-started"
                  className="rounded-full bg-[#f7f4ee] px-9 py-[1.125rem] text-center text-[15px] font-semibold text-black shadow-[0_10px_32px_rgba(0,0,0,0.4)] transition-all duration-500 hover:scale-[1.04] hover:bg-white hover:shadow-[0_12px_40px_rgb(var(--azee-orange)/0.35)] active:scale-[0.98] sm:w-auto"
                >
                  Open a Trading Account
                </Link>
                <a
                  href="#research"
                  className="glass-navy rounded-full px-9 py-[1.125rem] text-center text-[15px] font-semibold text-white transition-all duration-500 hover:scale-[1.04] hover:bg-white/10 hover:shadow-[0_0_32px_rgb(var(--azee-blue)/0.3)] active:scale-[0.98] sm:w-auto"
                >
                  View Research
                </a>
              </div>
            </FadeIn>

            <FadeIn delay={1350}>
              <div className="mt-8">
                <TrustBadges />
              </div>
            </FadeIn>
          </div>

          {/* Stacks below the CTAs up to xl; right column from xl. */}
          <div className="card-float relative w-full max-w-md xl:w-auto xl:max-w-none xl:shrink-0">
            {/* Soft blue backlight behind the snapshot */}
            <div
              aria-hidden="true"
              className="absolute -inset-10 rounded-full bg-[radial-gradient(ellipse_at_center,rgb(var(--azee-blue)/0.16),transparent_65%)] blur-2xl"
            />
            <div className="relative">
              <MarketSnapshot />
            </div>
          </div>
        </div>

        {/*
         * Market Pulse closes the hero's live-market zone: same
         * #markets anchor, same market-watch feed at the same cadence
         * as the snapshot above it.
         *
         * A full-width band rather than a third item in the snapshot's
         * column. Stacked there it inherited that column's width and
         * the two panels disagreed badly — 380px of snapshot above
         * 830px of gauge — while the hero's left half sat empty
         * beneath the headline. Across the full measure it uses the
         * room the row leaves behind, and the dial and its eight
         * signals sit side by side instead of running 600px down the
         * page.
         */}
        <div className="mx-auto w-full max-w-7xl">
          <MarketPulseGauge />
        </div>
      </div>
    </section>
  );
}
