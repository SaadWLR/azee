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
 * This is the 1080p (1920×1080, ~10 MB) variant — the same size class
 * as the Hero footage (which is actually larger, ~20 MB, and loads
 * reliably). ClosingCTA loads it immediately on mount, exactly like the
 * Hero, so it has the full page-dwell time to buffer before the visitor
 * scrolls to the bottom. The 4K variant was dropped: deferring a ~31 MB
 * file until the section neared the viewport left too little time to
 * buffer on real mobile/wifi connections, so the section sometimes
 * showed only its dark background — reliability now takes priority over
 * the extra sharpness.
 */
export const CLOSING_VIDEO_URL =
  "https://videos.pexels.com/video-files/36244310/15370737_1920_1080_30fps.mp4";
