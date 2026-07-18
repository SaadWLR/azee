import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, Outlet, RouterProvider } from "react-router-dom";
import App from "./App";
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
