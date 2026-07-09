import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fetchKse100Snapshot } from "../_lib/psxKse100";
import type { MarketSnapshot } from "../../src/types";

/**
 * GET /api/market/snapshot
 *
 * Live KSE-100 snapshot, normalized to the MarketSnapshot interface.
 * The frontend never talks to PSX directly (no CORS on the portal,
 * and the raw payload stays server-side).
 *
 * Caching: Vercel edge honours s-maxage, so PSX sees at most one
 * request per cache window regardless of traffic. Shorter during the
 * trading session, longer once the market is closed.
 */

/** Survives warm invocations; the graceful answer when PSX is down. */
let lastGood: MarketSnapshot | null = null;

function cacheControl(status: MarketSnapshot["status"]): string {
  return status === "OPEN"
    ? "s-maxage=60, stale-while-revalidate=300"
    : "s-maxage=1800, stale-while-revalidate=86400";
}

export default async function handler(
  _req: VercelRequest,
  res: VercelResponse,
) {
  try {
    const snapshot = await fetchKse100Snapshot();
    lastGood = snapshot;
    res.setHeader("Cache-Control", cacheControl(snapshot.status));
    res.status(200).json(snapshot);
  } catch (error) {
    console.error("KSE-100 snapshot fetch failed:", error);
    if (lastGood) {
      // Serve the last verified value, clearly labelled — never
      // fabricate market data.
      res.setHeader(
        "Cache-Control",
        "s-maxage=30, stale-while-revalidate=600",
      );
      res.status(200).json({ ...lastGood, stale: true, source: "cache" });
      return;
    }
    res.setHeader("Cache-Control", "no-store");
    res.status(503).json({
      error: "KSE-100 market data is temporarily unavailable",
    });
  }
}
