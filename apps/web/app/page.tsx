import type { Metadata } from "next";
import { BitEventTape } from "../components/bit/BitEventTape";
import { BitProduction } from "../components/bit/BitProduction";
import { BitVisualFeed } from "../components/bit/use-bit-visual";
import { readPublicRuntime } from "../lib/public-supabase";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "HEYBIT",
  description: "BIT is waking up.",
};

export default async function HomePage() {
  const runtime = await readPublicRuntime();

  return (
    <main className="home">
      <BitVisualFeed>
        <BitProduction />
        <p className="eyebrow">HEYBIT</p>
        <h1>BIT is waking up.</h1>
        <p className="home-status">BIT runtime: {runtime ? runtime.launchState : "unavailable"}</p>
        <p className="home-status">Official mint: {runtime ? (runtime.canonicalMint ?? "not launched") : "unavailable"}</p>
        <BitEventTape />
      </BitVisualFeed>
    </main>
  );
}
