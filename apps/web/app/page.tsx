import type { Metadata } from "next";
import { BitAsk } from "../components/bit/BitAsk";
import { BitEventTape } from "../components/bit/BitEventTape";
import { BitLifecycle } from "../components/bit/BitLifecycle";
import { BitProduction } from "../components/bit/BitProduction";
import { BitPrompt } from "../components/bit/BitPrompt";
import { BitReactionContext } from "../components/bit/BitReactionContext";
import { BitSpeech } from "../components/bit/BitSpeech";
import { BitState } from "../components/bit/BitState";
import { BitStatus } from "../components/bit/BitStatus";
import { BitVisualFeed } from "../components/bit/use-bit-visual";
import { SiteHeader } from "../components/site/SiteHeader";
import { readPublicPresence } from "../lib/public-supabase";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "HEYBIT",
  description: "BIT is waking up.",
};

export default async function HomePage() {
  const presence = await readPublicPresence();

  return (
    <main className="home">
      <BitVisualFeed>
        <SiteHeader current="home" />
        <BitProduction />
        <BitReactionContext />
        <BitSpeech />
        <BitLifecycle />
        <BitState />
        <BitAsk />
        <BitEventTape />
        <BitStatus
          launchState={presence.launchState}
          mint={presence.mint}
          runtimeKnown={presence.runtimeKnown}
        />
        <BitPrompt />
        <nav className="bit-factory" aria-label="Agent factory">
          <a href="/create">CREATE YOUR AGENT</a>
          <p>give your token a BIT.</p>
          <a href="/agents">VIEW AGENTS</a>
        </nav>
      </BitVisualFeed>
    </main>
  );
}
