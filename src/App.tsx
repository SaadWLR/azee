import { Navbar } from "./components/Navbar";
import { Hero } from "./components/Hero";
import { WhyAzee } from "./components/WhyAzee";
import { Products } from "./components/Products";
import { Research } from "./components/Research";
import { AppShowcase } from "./components/AppShowcase";
import { Stats } from "./components/Stats";
import { Footer } from "./components/Footer";

export default function App() {
  return (
    <main className="min-h-screen text-white">
      <Navbar />
      <Hero />
      <WhyAzee />
      <Products />
      <Research />
      <AppShowcase />
      <Stats />
      <Footer />
    </main>
  );
}
