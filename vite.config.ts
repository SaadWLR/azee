import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import { KNOWLEDGE_MODULES } from "./src/data/knowledge";

const SITE_ORIGIN = "https://azee.vercel.app";

/**
 * Builds sitemap.xml from the app's real routes plus the Knowledge
 * Centre module registry, so the module URLs are generated from the
 * same source the app renders — they can never drift from a
 * hand-typed list. Regenerated on every build; lastmod is the build
 * date. changefreq/priority scale from the fast-moving homepage and
 * live market page down to the static, content-pending module pages.
 */
function buildSitemap(): string {
  const lastmod = new Date().toISOString().slice(0, 10);
  const routes = [
    { path: "/", changefreq: "daily", priority: "1.0" },
    { path: "/market-watch", changefreq: "hourly", priority: "0.9" },
    { path: "/indices", changefreq: "hourly", priority: "0.9" },
    { path: "/commodities", changefreq: "hourly", priority: "0.9" },
    { path: "/etfs", changefreq: "hourly", priority: "0.8" },
    { path: "/announcements", changefreq: "hourly", priority: "0.8" },
    { path: "/corporate-calendar", changefreq: "daily", priority: "0.8" },
    { path: "/knowledge-centre", changefreq: "weekly", priority: "0.7" },
    ...KNOWLEDGE_MODULES.map((module) => ({
      path: `/knowledge-centre/${module.slug}`,
      changefreq: "monthly",
      priority: "0.5",
    })),
  ];

  const urls = routes
    .map(
      (route) =>
        `  <url>\n` +
        `    <loc>${SITE_ORIGIN}${route.path}</loc>\n` +
        `    <lastmod>${lastmod}</lastmod>\n` +
        `    <changefreq>${route.changefreq}</changefreq>\n` +
        `    <priority>${route.priority}</priority>\n` +
        `  </url>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

function sitemapPlugin(): Plugin {
  return {
    name: "azee-sitemap",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "sitemap.xml",
        source: buildSitemap(),
      });
    },
  };
}

/*
 * Sentry source-map upload. Enabled only when all three credentials are
 * present, so a build without them (a contributor's laptop, a fork, a
 * preview with the vars unset) simply produces no source maps and
 * uploads nothing — it must never fail the build over a missing
 * credential, which on this project would take the whole site down.
 *
 * Maps are uploaded and then DELETED from dist: Sentry gets what it
 * needs to render readable stack traces without the built site serving
 * the full unminified source to anyone who asks for the .map.
 */
const { SENTRY_ORG, SENTRY_PROJECT, SENTRY_AUTH_TOKEN } = process.env;
const sentryUploadEnabled = Boolean(
  SENTRY_ORG && SENTRY_PROJECT && SENTRY_AUTH_TOKEN,
);

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    sitemapPlugin(),
    ...(sentryUploadEnabled
      ? [
          sentryVitePlugin({
            org: SENTRY_ORG,
            project: SENTRY_PROJECT,
            authToken: SENTRY_AUTH_TOKEN,
            telemetry: false,
            sourcemaps: { filesToDeleteAfterUpload: ["./dist/**/*.map"] },
            /*
             * A failed upload (expired token, Sentry outage, rate
             * limit) must degrade to "stack traces are minified",
             * never to "the deploy fails". Swallowing the error here
             * is the difference between losing symbolication and
             * losing the site.
             */
            errorHandler: (err) => {
              console.warn(
                "[sentry] source-map upload failed; continuing build:",
                err.message,
              );
            },
          }),
        ]
      : []),
  ],
  // Source maps exist only to be uploaded; without upload credentials
  // there is nothing to produce them for.
  build: { sourcemap: sentryUploadEnabled },
});
