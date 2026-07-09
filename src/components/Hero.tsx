import { useEffect, useRef, type MouseEvent } from "react";
import { AnimatedHeading } from "./AnimatedHeading";
import { FadeIn } from "./FadeIn";
import { MarketSnapshot } from "./MarketSnapshot";
import { TickerTape } from "./TickerTape";
import { TrustBadges } from "./TrustBadges";
import { HERO_VIDEO_URL } from "../config";

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
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Some browsers pause muted autoplay videos until play() is
    // called explicitly; the catch swallows rejected autoplay.
    videoRef.current?.play().catch(() => {});
  }, []);

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
   * row centered in the remaining space (my-auto). min-h-screen fills
   * the first viewport but never locks it — taller content simply
   * extends the page and scrolls.
   */
  return (
    <section
      className="relative flex min-h-screen w-full flex-col overflow-hidden bg-black"
      onMouseMove={handleMouseMove}
    >
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 ease-out"
        style={{ transform: "scale(1.06)" }}
        src={HERO_VIDEO_URL}
        autoPlay
        muted
        loop
        playsInline
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

      <div className="relative z-10 flex w-full flex-1 px-4 py-10 sm:px-6 sm:py-14 lg:px-12 lg:py-16">
        <div className="mx-auto my-auto flex w-full max-w-7xl flex-col items-start justify-between gap-8 lg:gap-10 xl:flex-row">
          <div className="w-full max-w-3xl lg:max-w-4xl">
            <AnimatedHeading
              lines={["Market intelligence.", "Real-time execution."]}
              baseDelay={300}
              charStagger={30}
              className="text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl"
            />

            <FadeIn delay={1000}>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-gray-300 sm:text-lg">
                AZEE Securities connects investors to the Pakistan Stock
                Exchange — equity research, live market data, and disciplined
                order execution across PSX and PMEX since 2003.
              </p>
            </FadeIn>

            <FadeIn delay={1200}>
              <div className="mt-8 flex flex-col items-stretch gap-4 sm:flex-row sm:flex-wrap sm:items-center">
                <a
                  href="#"
                  className="rounded-full bg-white px-8 py-4 text-center text-sm font-semibold text-black transition-all duration-300 hover:scale-105 hover:bg-gray-200 sm:w-auto"
                >
                  Open a Trading Account
                </a>
                <a
                  href="#"
                  className="liquid-glass rounded-full px-8 py-4 text-center text-sm font-semibold text-white transition-all duration-300 hover:scale-105 hover:bg-white/20 sm:w-auto"
                >
                  View Research
                </a>
              </div>
            </FadeIn>

            <FadeIn delay={1350}>
              <div className="mt-6">
                <TrustBadges />
              </div>
            </FadeIn>
          </div>

          {/* Stacks below the CTAs up to xl; right column from xl. */}
          <div className="w-full max-w-md xl:w-auto xl:max-w-none xl:shrink-0">
            <MarketSnapshot />
          </div>
        </div>
      </div>
    </section>
  );
}
