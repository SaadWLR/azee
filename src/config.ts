/**
 * Background video for the hero section.
 *
 * Swap this single URL to change the hero footage. Any MP4 works —
 * it is rendered full-screen, object-cover, autoplaying, muted, and
 * looped with no overlay or tint on top.
 *
 * Current footage: a dark rotating globe of connected points of
 * light (Pexels, free license) — global capital markets. Suitable
 * alternatives: trading terminals, stock charts, or skyline footage
 * of Karachi's financial district, e.g.
 * https://videos.pexels.com/video-files/3130284/3130284-hd_1920_1080_30fps.mp4
 * (streaming market-data digits).
 */
export const HERO_VIDEO_URL =
  "https://videos.pexels.com/video-files/3129957/3129957-hd_1920_1080_25fps.mp4";

/**
 * Background video for the Knowledge Centre hero.
 *
 * A moonlit night sky (Pexels, free license) — a calm, cool-toned,
 * blue/moonlight aesthetic for the investor-education hub, deliberately
 * distinct from the homepage's markets footage. Same technical setup as
 * HERO_VIDEO_URL: full-screen, object-cover, autoplay/muted/loop.
 */
export const KNOWLEDGE_HERO_VIDEO_URL =
  "https://videos.pexels.com/video-files/11533576/11533576-hd_1920_1080_30fps.mp4";

/**
 * Background video for the homepage's closing CTA section.
 *
 * A cinematic aerial night city skyline (Pexels, free license) —
 * energetic, urban, cool-toned, deliberately more kinetic than the
 * Knowledge Centre's calm moonlit footage. It bookends the homepage's
 * opening market video with a second, closing visual moment.
 *
 * This is the 4K (3840×2160, ~31 MB) variant, chosen for sharpness.
 * Because the section sits at the very bottom of the homepage (below
 * the fold), ClosingCTA loads this only when the section approaches the
 * viewport — a visitor who never scrolls that far never fetches it.
 */
export const CLOSING_VIDEO_URL =
  "https://videos.pexels.com/video-files/36244310/15370741_3840_2160_30fps.mp4";
