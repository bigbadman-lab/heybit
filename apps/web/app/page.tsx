import type { Metadata } from "next";
import { BitEventTape } from "../components/bit/BitEventTape";
import { BitProduction } from "../components/bit/BitProduction";
import { BitPrompt } from "../components/bit/BitPrompt";
import { BitReactionContext } from "../components/bit/BitReactionContext";
import { BitSpeech } from "../components/bit/BitSpeech";
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
        <p className="eyebrow">HEYBIT</p>
        <BitProduction />
        <BitReactionContext />
        <BitSpeech />
        <BitEventTape />
        <BitStatus
          launchState={runtime ? runtime.launchState : null}
          mint={runtime ? runtime.canonicalMint : null}
          runtimeKnown={runtime !== null}
        />
        <BitPrompt />
      </BitVisualFeed>
    </main>
  );
}
