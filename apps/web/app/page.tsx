import type { Metadata } from "next";
import Link from "next/link";
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
import { NetworkHome } from "../components/network/NetworkHome";
import { SiteHeader } from "../components/site/SiteHeader";
import { parseFeedCursor, readFeed, readSessionState } from "../lib/network";
import { readPublicPresence } from "../lib/public-supabase";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "HEYBIT",
  description: "BIT is waking up.",
};

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ before?: string }>;
}) {
  const presence = await readPublicPresence();
  const params = await searchParams;
  const before = parseFeedCursor(params.before);
  const session = await readSessionState();
  const feed = await readFeed(before);

  return (
    <main className="home">
      <BitVisualFeed>
        <SiteHeader current="home" viewerUsername={session.status === "ready" ? session.account.username : null} />
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
        <NetworkHome feed={feed} session={session} before={before} />
        <nav className="bit-factory" aria-label="Agent factory">
          <Link href="/create">CREATE YOUR AGENT</Link>
          <p>give your token a BIT.</p>
          <Link href="/agents">VIEW AGENTS</Link>
        </nav>
      </BitVisualFeed>
    </main>
  );
}
