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
const NEWS_FIXTURE: NewsFeedResponse = {
  items: [
    {
      title: "KSE-100 extends gains as banking sector leads session (example)",
      link: "https://www.brecorder.com/",
      source: "Business Recorder",
      publishedAt: "2026-07-11T11:30:00.000Z",
      summary:
        "Example development-only headline. In production this section shows real, live articles from Business Recorder.",
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
      source: "Business Recorder",
      publishedAt: "2026-07-11T05:00:00.000Z",
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
