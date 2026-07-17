import { apiGet, mockResponse } from "../lib/apiClient";
import type { NewsFeedResponse } from "../types";

/*
 * Live market news comes from /api/news/latest (Business Recorder via
 * the Edge Runtime). Under `vite dev` the serverless route doesn't
 * run, so the DEV fixture below keeps local development working.
 *
 * The fixture headlines are fictional, clearly-example placeholders —
 * NOT real scraped content baked into source. Production always
 * serves real, attributed, live articles.
 */

/*
 * A self-contained placeholder image (inline SVG data URI) so the
 * with-image layout is exercised in local dev without hotlinking a
 * real publisher photo — fixtures shouldn't depend on external
 * fetches, and this is deliberately, visibly a dev placeholder rather
 * than anything posing as real editorial imagery. Only some fixture
 * items carry it, so the no-image layout is exercised locally too.
 */
const FIXTURE_IMAGE =
  "data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20width%3D'1000'%20height%3D'600'%20viewBox%3D'0%200%201000%20600'%3E%3Crect%20width%3D'1000'%20height%3D'600'%20fill%3D'rgb(15%2C23%2C42)'%2F%3E%3Cpolyline%20points%3D'0%2C430%20160%2C380%20320%2C450%20480%2C300%20640%2C350%20800%2C210%201000%2C250'%20fill%3D'none'%20stroke%3D'rgb(96%2C165%2C250)'%20stroke-width%3D'6'%20stroke-linejoin%3D'round'%2F%3E%3Ctext%20x%3D'48'%20y%3D'92'%20font-family%3D'sans-serif'%20font-size%3D'34'%20font-weight%3D'700'%20fill%3D'rgb(148%2C163%2C184)'%3EExample%20image%20%E2%80%94%20dev%20fixture%3C%2Ftext%3E%3C%2Fsvg%3E";

const NEWS_FIXTURE: NewsFeedResponse = {
  items: [
    {
      title: "KSE-100 extends gains as banking sector leads session (example)",
      link: "https://www.brecorder.com/",
      source: "Business Recorder",
      publishedAt: "2026-07-11T11:30:00.000Z",
      summary:
        "Example development-only headline. In production this section shows real, live articles from Business Recorder.",
      imageUrl: FIXTURE_IMAGE,
    },
    {
      title: "SECP notifies updated disclosure framework for listed firms (example)",
      link: "https://www.brecorder.com/",
      source: "Business Recorder",
      publishedAt: "2026-07-11T07:15:00.000Z",
    },
    {
      title: "Sukuk issuance draws strong institutional demand (example)",
      link: "https://www.brecorder.com/",
      source: "The Express Tribune",
      publishedAt: "2026-07-11T05:00:00.000Z",
      imageUrl: FIXTURE_IMAGE,
    },
    {
      title: "Rupee holds firm against the dollar in interbank trade (example)",
      link: "https://www.brecorder.com/",
      source: "Business Recorder",
      publishedAt: "2026-07-10T13:45:00.000Z",
    },
    {
      title: "Gold prices ease as global bullion softens (example)",
      link: "https://www.brecorder.com/",
      source: "Business Recorder",
      publishedAt: "2026-07-10T09:20:00.000Z",
    },
  ],
  asOf: "2026-07-11T12:00:00.000Z",
  source: "live",
};

/** Latest attributed market headlines, newest first. */
export async function getLatestNews(): Promise<NewsFeedResponse> {
  if (import.meta.env.DEV) {
    return mockResponse(NEWS_FIXTURE);
  }
  return apiGet<NewsFeedResponse>("/api/news/latest");
}
