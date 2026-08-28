// FIRST import on purpose: initializes Sentry before any app module is
// evaluated (see src/instrument.ts). Keep it at the top of this list.
import "./instrument";
import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, Outlet, RouterProvider } from "react-router-dom";
import App from "./App";
import { CookieConsent } from "./components/CookieConsent";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ScrollToHash } from "./components/ScrollToHash";
import "./index.css";

/*
 * The Market Watch page is lazy-loaded so its code (and React Router's
 * weight it builds on) splits into a separate chunk, off the main
 * bundle every homepage visitor downloads. A visitor who never opens
 * /market-watch never fetches it.
 */
const MarketWatchPage = lazy(() =>
  import("./components/MarketWatchPage").then((m) => ({
    default: m.MarketWatchPage,
  })),
);

const IndicesPage = lazy(() =>
  import("./components/IndicesPage").then((m) => ({
    default: m.IndicesPage,
  })),
);

const CommoditiesPage = lazy(() =>
  import("./components/CommoditiesPage").then((m) => ({
    default: m.CommoditiesPage,
  })),
);

const FearAndOptimismPage = lazy(() =>
  import("./components/FearAndOptimismPage").then((m) => ({
    default: m.FearAndOptimismPage,
  })),
);

const LegalPage = lazy(() =>
  import("./components/LegalPage").then((m) => ({
    default: m.LegalPage,
  })),
);

/*
 * Legal / compliance routes. The path→slug pairs are listed here rather
 * than imported from src/data/legal.ts on purpose: importing the
 * registry would pull every page's body text into the main bundle that
 * every homepage visitor downloads. The registry stays inside the
 * lazy-loaded LegalPage chunk; these are just the addresses.
 */
const LEGAL_ROUTES = [
  "privacy-policy",
  "terms-of-use",
  "risk-disclosure",
  "regulatory-information",
  "complaints",
  "cookie-policy",
  "forms-downloads",
  "aml-kyc",
  "fee-schedule",
];

const MutualFundsPage = lazy(() =>
  import("./components/MutualFundsPage").then((m) => ({
    default: m.MutualFundsPage,
  })),
);

const EconomicDashboardPage = lazy(() =>
  import("./components/EconomicDashboardPage").then((m) => ({
    default: m.EconomicDashboardPage,
  })),
);

const ForexPage = lazy(() =>
  import("./components/ForexPage").then((m) => ({
    default: m.ForexPage,
  })),
);

const EtfsPage = lazy(() =>
  import("./components/EtfsPage").then((m) => ({
    default: m.EtfsPage,
  })),
);

const AnnouncementsPage = lazy(() =>
  import("./components/AnnouncementsPage").then((m) => ({
    default: m.AnnouncementsPage,
  })),
);

const CorporateCalendarPage = lazy(() =>
  import("./components/CorporateCalendarPage").then((m) => ({
    default: m.CorporateCalendarPage,
  })),
);

const KnowledgeCentrePage = lazy(() =>
  import("./components/KnowledgeCentrePage").then((m) => ({
    default: m.KnowledgeCentrePage,
  })),
);

const KnowledgeModulePage = lazy(() =>
  import("./components/KnowledgeModulePage").then((m) => ({
    default: m.KnowledgeModulePage,
  })),
);

const AboutPage = lazy(() =>
  import("./components/AboutPage").then((m) => ({ default: m.AboutPage })),
);

const ContactPage = lazy(() =>
  import("./components/ContactPage").then((m) => ({ default: m.ContactPage })),
);

const GetStartedPage = lazy(() =>
  import("./components/GetStartedPage").then((m) => ({
    default: m.GetStartedPage,
  })),
);

const NotFoundPage = lazy(() =>
  import("./components/NotFoundPage").then((m) => ({
    default: m.NotFoundPage,
  })),
);

function PageLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-black text-sm text-gray-400">
      Loading…
    </main>
  );
}

/**
 * Path-less layout route: mounts router-level behaviors (currently
 * scroll-to-hash / scroll-to-top on navigation) exactly once, above
 * every current and future route.
 */
function RootLayout() {
  return (
    <>
      <ScrollToHash />
      <Outlet />
      {/* Mounted once above every route so the consent choice is
          offered and honoured site-wide, not per page. */}
      <CookieConsent />
    </>
  );
}

/*
 * Routing shell. The homepage ("/") stays eager in the main bundle;
 * the other pages code-split. Plain in-page hash anchors on the
 * homepage are handled natively by the browser and are not
 * intercepted by the router; cross-route hash navigation is handled
 * by ScrollToHash in the layout route.
 */
const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      {
        path: "/",
        element: <App />,
      },
      {
        path: "/market-watch",
        element: (
          <Suspense fallback={<PageLoading />}>
            <MarketWatchPage />
          </Suspense>
        ),
      },
      {
        path: "/fear-and-optimism-index",
        element: (
          <Suspense fallback={<PageLoading />}>
            <FearAndOptimismPage />
          </Suspense>
        ),
      },
      {
        path: "/indices",
        element: (
          <Suspense fallback={<PageLoading />}>
            <IndicesPage />
          </Suspense>
        ),
      },
      {
        path: "/commodities",
        element: (
          <Suspense fallback={<PageLoading />}>
            <CommoditiesPage />
          </Suspense>
        ),
      },
      ...LEGAL_ROUTES.map((slug) => ({
        path: `/${slug}`,
        element: (
          <Suspense fallback={<PageLoading />}>
            <LegalPage slug={slug} />
          </Suspense>
        ),
      })),
      {
        path: "/mutual-funds",
        element: (
          <Suspense fallback={<PageLoading />}>
            <MutualFundsPage />
          </Suspense>
        ),
      },
      {
        path: "/economic-dashboard",
        element: (
          <Suspense fallback={<PageLoading />}>
            <EconomicDashboardPage />
          </Suspense>
        ),
      },
      {
        path: "/forex",
        element: (
          <Suspense fallback={<PageLoading />}>
            <ForexPage />
          </Suspense>
        ),
      },
      {
        path: "/etfs",
        element: (
          <Suspense fallback={<PageLoading />}>
            <EtfsPage />
          </Suspense>
        ),
      },
      {
        path: "/announcements",
        element: (
          <Suspense fallback={<PageLoading />}>
            <AnnouncementsPage />
          </Suspense>
        ),
      },
      {
        path: "/corporate-calendar",
        element: (
          <Suspense fallback={<PageLoading />}>
            <CorporateCalendarPage />
          </Suspense>
        ),
      },
      {
        path: "/knowledge-centre",
        element: (
          <Suspense fallback={<PageLoading />}>
            <KnowledgeCentrePage />
          </Suspense>
        ),
      },
      {
        path: "/knowledge-centre/:moduleSlug",
        element: (
          <Suspense fallback={<PageLoading />}>
            <KnowledgeModulePage />
          </Suspense>
        ),
      },
      {
        path: "/about",
        element: (
          <Suspense fallback={<PageLoading />}>
            <AboutPage />
          </Suspense>
        ),
      },
      {
        path: "/contact",
        element: (
          <Suspense fallback={<PageLoading />}>
            <ContactPage />
          </Suspense>
        ),
      },
      {
        path: "/get-started",
        element: (
          <Suspense fallback={<PageLoading />}>
            <GetStartedPage />
          </Suspense>
        ),
      },
      {
        /*
         * Catch-all, LAST on purpose — React Router matches in order,
         * so anything above still wins. Without this an unknown path
         * rendered nothing at all under the SPA rewrite (the host
         * returns the shell with HTTP 200 for every path), which looks
         * like a broken site rather than a wrong address.
         */
        path: "*",
        element: (
          <Suspense fallback={<PageLoading />}>
            <NotFoundPage />
          </Suspense>
        ),
      },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* Top-level boundary wraps the whole router, preserving the
        "app can't white-screen" guarantee across every route. */}
    <ErrorBoundary>
      <RouterProvider router={router} />
    </ErrorBoundary>
  </StrictMode>,
);
