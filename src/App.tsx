import { Navbar } from "./components/Navbar";
import { Hero } from "./components/Hero";
import { WhyAzee } from "./components/WhyAzee";
import { Products } from "./components/Products";
import { Research } from "./components/Research";
import { AppShowcase } from "./components/AppShowcase";
import { Stats } from "./components/Stats";
import { Footer } from "./components/Footer";
import { ErrorBoundary } from "./components/ErrorBoundary";

/*
 * Section-level boundaries wrap the two live-data regions (the hero's
 * market panel/ticker and the news section) so a crash in either
 * degrades to a local fallback instead of taking the page down; the
 * remaining sections are static content with near-zero crash risk and
 * are covered by the app-level boundary in main.tsx.
 */
export default function App() {
  return (
    <main className="min-h-screen text-white">
      <Navbar />
      <ErrorBoundary label="the market overview">
        <Hero />
      </ErrorBoundary>
      <WhyAzee />
      <Products />
      <ErrorBoundary label="the market news section">
        <Research />
      </ErrorBoundary>
      <AppShowcase />
      <Stats />
      <Footer />
    </main>
  );
}
