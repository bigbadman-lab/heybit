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
        <div className="bit-identity">
          <p className="eyebrow">HEYBIT</p>
          <a className="bit-x" href="https://x.com/bitdotfun" target="_blank" rel="noopener noreferrer" aria-label="X">
            <svg viewBox="0 0 1200 1227" aria-hidden="true" focusable="false">
              <path
                fill="currentColor"
                d="M714.163 519.284L1160.89 0H1055.03L667.137 450.887L357.328 0H0L468.492 681.821L0 1226.37H105.866L515.491 750.218L842.672 1226.37H1200L714.137 519.284H714.163ZM569.165 687.828L521.697 619.934L144.011 79.6944H306.615L611.412 515.685L658.88 583.579L1055.08 1150.3H892.476L569.165 687.854V687.828Z"
              />
            </svg>
          </a>
        </div>
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
