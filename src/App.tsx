import { Navbar } from "./components/Navbar";
import { Hero } from "./components/Hero";
import { WhyAzee } from "./components/WhyAzee";
import { Products } from "./components/Products";
import { Research } from "./components/Research";
import { AppShowcase } from "./components/AppShowcase";
import { Stats } from "./components/Stats";
import { ClosingCTA } from "./components/ClosingCTA";
import { Footer } from "./components/Footer";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { usePageMeta } from "./hooks/usePageMeta";

/*
 * Section-level boundaries wrap the two live-data regions (the hero's
 * market panel/ticker and the news section) so a crash in either
 * degrades to a local fallback instead of taking the page down; the
 * remaining sections are static content with near-zero crash risk and
 * are covered by the app-level boundary in main.tsx.
 */
export default function App() {
  // Homepage keeps the site-wide default title/description.
  usePageMeta();
  return (
    <main className="min-h-screen text-white">
      <Navbar />
      <ErrorBoundary label="the market overview">
        <Hero />
      </ErrorBoundary>
      <WhyAzee />
      <Products />
      {/*
       * The conversion section sits FOURTH, directly after Products —
       * it used to be last, reachable only after the entire page.
       *
       * WhyAzee and Products together answer "who are you" and "what do
       * you offer". The question that follows is "show me", and this
       * section answers it with a working lookup on live PSX prices,
       * then asks for the account. Putting the ask at the moment of
       * peak interest — about one screen of scrolling in — beats
       * putting it after seven sections, where only the most patient
       * visitor ever arrived.
       *
       * Research, AppShowcase and Stats still follow for anyone who
       * wants more proof before deciding, and the Footer carries the
       * same CTA for them.
       *
       * Wrapped in a boundary like the other live-data regions: it now
       * reads the market-watch feed, so a crash here degrades to a
       * local fallback instead of taking the homepage down.
       */}
      <ErrorBoundary label="the live symbol lookup">
        <ClosingCTA />
      </ErrorBoundary>
      <ErrorBoundary label="the market news section">
        <Research />
      </ErrorBoundary>
      <AppShowcase />
      <Stats />
      <Footer />
    </main>
  );
}
