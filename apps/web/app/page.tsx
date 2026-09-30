import type { Metadata } from "next";
import { BitProduction } from "../components/bit/BitProduction";
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
      <BitProduction />
      <p className="eyebrow">HEYBIT</p>
      <h1>BIT is waking up.</h1>
      <p className="home-status">BIT runtime: {runtime ? runtime.launchState : "unavailable"}</p>
      <p className="home-status">Official mint: {runtime ? (runtime.canonicalMint ?? "not launched") : "unavailable"}</p>
    </main>
  );
}
