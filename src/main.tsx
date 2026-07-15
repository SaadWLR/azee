import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
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

function PageLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-black text-sm text-gray-400">
      Loading…
    </main>
  );
}

/*
 * Routing shell. The homepage ("/") stays eager in the main bundle;
 * /market-watch code-splits. Plain in-page hash anchors on the
 * homepage are handled natively by the browser and are not
 * intercepted by the router.
 */
const router = createBrowserRouter([
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
