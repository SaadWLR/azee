import type { VercelRequest, VercelResponse } from "@vercel/node";

/** TEMPORARY Step-1 probe for Twelve Data. Returns diagnostics only —
 *  NEVER the key value. Deleted before the real endpoint commit. */
export default async function handler(_req: VercelRequest, res: VercelResponse) {
  // The var is set lowercase in Vercel; tolerate both for the probe.
  const key =
    process.env.TWELVE_DATA_API_KEY ?? process.env.twelve_data_api_key;
  if (!key) {
    // Diagnostics only — env var NAMES, never values. Distinguishes
    // "env injection broken" from "var not set for this environment".
    const related = Object.keys(process.env).filter((n) =>
      /twelve|twelvedata|td_|_data_api|api_key/i.test(n),
    );
    res.status(200).json({
      keyPresent: false,
      vercelEnv: process.env.VERCEL_ENV ?? null,
      vercelEnvVarsInjected: Boolean(process.env.VERCEL || process.env.VERCEL_ENV),
      relatedEnvVarNames: related,
      totalEnvVarCount: Object.keys(process.env).length,
      note: "TWELVE_DATA_API_KEY not visible to this Production function",
    });
    return;
  }

  const candidates = ["SPX", "DJI", "IXIC", "NDX", "FTSE", "N225", "DAX", "HSI"];
  const out: Record<string, unknown> = { keyPresent: true, keyLen: key.length };

  // 1) Batch request (comma-separated) — is multi-symbol allowed on this tier?
  try {
    const url = `https://api.twelvedata.com/quote?symbol=${candidates.join(",")}&apikey=${key}`;
    const r = await fetch(url);
    const body = (await r.json()) as Record<string, unknown>;
    // Redact any echoed key just in case (Twelve Data never echoes it, but be safe).
    const batchSummary: Record<string, unknown> = { httpStatus: r.status };
    // Batch success shape: { SPX: {...}, DJI: {...} }. Error shape: { code, message, status }.
    if (body && typeof body === "object" && "code" in body) {
      batchSummary.isError = true;
      batchSummary.code = body.code;
      batchSummary.message = body.message;
    } else {
      batchSummary.isError = false;
      batchSummary.keysReturned = Object.keys(body);
      // per-symbol: did each resolve to a quote or a per-symbol error?
      batchSummary.perSymbol = Object.fromEntries(
        Object.entries(body).map(([k, v]) => {
          const q = v as Record<string, unknown>;
          return [k, q && "code" in q ? { error: q.code, msg: q.message } : { ok: true, close: q?.close, datetime: q?.datetime, name: q?.name, exchange: q?.exchange }];
        }),
      );
    }
    out.batch = batchSummary;
  } catch (e) {
    out.batch = { fetchError: String(e) };
  }

  // 2) Full single-symbol response (SPX) to enumerate REAL available fields.
  try {
    const r = await fetch(`https://api.twelvedata.com/quote?symbol=SPX&apikey=${key}`);
    const q = (await r.json()) as Record<string, unknown>;
    out.spxFields = Object.keys(q);
    out.spxSample = {
      symbol: q.symbol, name: q.name, exchange: q.exchange, currency: q.currency,
      datetime: q.datetime, timestamp: q.timestamp,
      open: q.open, high: q.high, low: q.low, close: q.close,
      previous_close: q.previous_close, change: q.change, percent_change: q.percent_change,
      is_market_open: q.is_market_open,
    };
    // delay: quote timestamp vs now
    if (typeof q.timestamp === "number") {
      out.observedDelaySeconds = Math.round(Date.now() / 1000 - (q.timestamp as number));
    }
  } catch (e) {
    out.spx = { fetchError: String(e) };
  }

  // 3) Bad-key behavior (graceful error shape) — uses an obviously invalid key.
  try {
    const r = await fetch(`https://api.twelvedata.com/quote?symbol=SPX&apikey=INVALID_TEST_KEY_000`);
    const b = (await r.json()) as Record<string, unknown>;
    out.invalidKeyResponse = { httpStatus: r.status, code: b.code, status: b.status, message: b.message };
  } catch (e) {
    out.invalidKeyResponse = { fetchError: String(e) };
  }

  res.setHeader("Cache-Control", "no-store");
  res.status(200).json(out);
}
