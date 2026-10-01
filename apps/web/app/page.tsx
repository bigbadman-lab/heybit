import type { Metadata } from "next";
import { BitEventTape } from "../components/bit/BitEventTape";
import { BitProduction } from "../components/bit/BitProduction";
import { BitReactionContext } from "../components/bit/BitReactionContext";
import { BitStatus } from "../components/bit/BitStatus";
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
        <BitReactionContext />
        <p className="eyebrow">HEYBIT</p>
        <h1>BIT is waking up.</h1>
        <BitEventTape />
        <BitStatus
          launchState={runtime ? runtime.launchState : null}
          mint={runtime ? runtime.canonicalMint : null}
          runtimeKnown={runtime !== null}
        />
      </BitVisualFeed>
    </main>
  );
}
