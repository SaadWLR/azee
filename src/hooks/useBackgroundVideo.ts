import { useEffect, useRef } from "react";

/**
 * Shared setup for the site's decorative background videos — the Hero
 * globe, the Knowledge Centre moonlit hero, and the homepage Closing
 * CTA skyline. Each is a muted, looping, autoplaying MP4 sitting behind
 * an always-present solid-black base and dark overlays, so a slow or
 * failed load degrades to an on-brand dark background rather than a
 * broken gap.
 *
 * Responsibilities, kept identical across all three so none can quietly
 * regress:
 *  - Kick off playback on mount. Some browsers hold muted autoplay
 *    until play() is called explicitly; the rejection is swallowed.
 *  - Slow playback slightly (0.75x) for a calmer, cinematic feel.
 *  - Recover from a transient load error with a single reload retry,
 *    then log if it still fails — so a flaky mobile/wifi connection
 *    doesn't leave a permanently blank section with no diagnostic
 *    trail. The dark overlays remain visible throughout as the
 *    fallback, so there is nothing to render on failure beyond logging.
 *
 * Returns the video ref (also used by each section's mouse-parallax
 * handler) and the onError handler to wire onto the <video>.
 */
export function useBackgroundVideo(playbackRate = 0.75) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const retriedRef = useRef(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    // defaultPlaybackRate persists across a load() retry; playbackRate
    // is what actually applies to the current playback.
    video.defaultPlaybackRate = playbackRate;
    video.playbackRate = playbackRate;
    video.play().catch(() => {});
  }, [playbackRate]);

  const handleError = () => {
    const video = videoRef.current;
    if (!video) return;
    if (!retriedRef.current) {
      // One retry absorbs a transient network blip without looping
      // forever on a genuinely bad source.
      retriedRef.current = true;
      video.load();
      video.playbackRate = playbackRate;
      video.play().catch(() => {});
      return;
    }
    console.warn(
      "[background-video] load failed after retry:",
      video.currentSrc || video.src,
    );
  };

  return { videoRef, onError: handleError };
}
