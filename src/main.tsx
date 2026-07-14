import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./index.css";

/*
 * Routing shell. The existing homepage is the sole route for now; a
 * later milestone adds the Screener route to this array. Plain in-page
 * hash anchors (Navbar → #markets etc.) are handled natively by the
 * browser and are not intercepted by the router, so section
 * navigation behaves exactly as before.
 */
const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
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
