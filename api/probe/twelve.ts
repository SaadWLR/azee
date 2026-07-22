import type { VercelRequest, VercelResponse } from "@vercel/node";

/** TEMPORARY Step-1 probe. Diagnostics only, never the key value.
 *  Frugal: one batch request of ?syms=... (default small) to stay under
 *  the 8-credit/min free-tier limit. Deleted before the real endpoint. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const key =
    process.env.TWELVE_DATA_API_KEY ?? process.env.twelve_data_api_key;
  if (!key) {
    res.status(200).json({ keyPresent: false });
    return;
  }
  const syms =
    (typeof req.query.syms === "string" && req.query.syms) || "SPX,DJI,IXIC";
  const out: Record<string, unknown> = { keyLen: key.length, requested: syms };
  try {
    const r = await fetch(
      `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(syms)}&apikey=${key}`,
    );
    const body = (await r.json()) as Record<string, any>;
    out.httpStatus = r.status;
    if (body && "code" in body && "message" in body && !("symbol" in body)) {
      out.topLevelError = { code: body.code, message: body.message };
    } else {
      // Single symbol → flat object; multi → keyed by symbol.
      const entries = "symbol" in body ? [[body.symbol, body]] : Object.entries(body);
      out.perSymbol = Object.fromEntries(
        entries.map(([k, v]: [string, any]) => [
          k,
          v && "code" in v && v.status === "error"
            ? { error: v.code, message: v.message }
            : {
                ok: true,
                name: v.name,
                exchange: v.exchange,
                currency: v.currency,
                close: v.close,
                change: v.change,
                percent_change: v.percent_change,
                open: v.open,
                high: v.high,
                low: v.low,
                previous_close: v.previous_close,
                datetime: v.datetime,
                timestamp: v.timestamp,
                is_market_open: v.is_market_open,
                delaySec:
                  typeof v.timestamp === "number"
                    ? Math.round(Date.now() / 1000 - v.timestamp)
                    : null,
                fieldNames: Object.keys(v),
              },
        ]),
      );
    }
  } catch (e) {
    out.fetchError = String(e);
  }
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json(out);
}
