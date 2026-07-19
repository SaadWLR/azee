import { useEffect, useRef, type MouseEvent } from "react";
import { CLOSING_VIDEO_URL } from "../config";

/**
 * Homepage closing section — a second, cinematic video moment that
 * bookends the opening Hero, sitting just above the Footer. Reuses the
 * established video technique (muted autoplay loop, playbackRate 0.75,
 * soft mouse-parallax) with its own energetic night-city footage, its
 * own centered layout, original closing copy, and independently-scoped
 * .closing-glass / .closing-fade-up styling — no overlap with Hero,
 * Knowledge Centre, or the site-wide glass classes.
 */
export function ClosingCTA() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = 0.75;
    video.play().catch(() => {});
  }, []);

  const handleMouseMove = (event: MouseEvent<HTMLElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const x = (event.clientX / window.innerWidth - 0.5) * 12;
    const y = (event.clientY / window.innerHeight - 0.5) * 8;
    video.style.transform = `scale(1.06) translate(${-x}px, ${-y}px)`;
  };

  return (
    <section
      className="relative flex min-h-[80vh] w-full items-center overflow-hidden bg-black py-24 sm:py-28"
      onMouseMove={handleMouseMove}
    >
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 ease-out"
        style={{ transform: "scale(1.06)" }}
        src={CLOSING_VIDEO_URL}
        autoPlay
        muted
        loop
        playsInline
      />

      {/* Dark scrim for legibility + a cool navy vignette for brand
          cohesion over the vibrant city lights. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/45 to-black/75"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_50%,transparent,rgb(var(--azee-navy)/0.55))]"
      />

      <div className="relative z-10 mx-auto w-full max-w-3xl px-4 text-center sm:px-6 lg:px-12">
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
          className="closing-fade-up mx-auto mt-6 max-w-xl text-base leading-relaxed text-gray-300 sm:text-lg"
          style={{ animationDelay: "0.55s" }}
        >
          Live PSX prices, market research, and order execution — the full
          picture, and the tools to act on it, in a single AZEE account.
        </p>

        <div
          className="closing-fade-up mt-9 flex justify-center"
          style={{ animationDelay: "0.7s" }}
        >
          <a
            href="#"
            className="closing-glass rounded-full px-9 py-4 text-center text-[15px] font-semibold text-white transition-transform duration-300 hover:scale-[1.04] active:scale-[0.98]"
          >
            Open a Trading Account
          </a>
        </div>
      </div>
    </section>
  );
}
