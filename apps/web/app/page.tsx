import { readPublicRuntime } from "../lib/public-supabase";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const runtime = await readPublicRuntime();

  return (
    <main>
      <p className="eyebrow">HEYBIT · development</p>
      <h1>Development foundation</h1>
      <p>This is not the live BIT website.</p>
      <p>BIT runtime: {runtime ? runtime.launchState : "unavailable"}</p>
      <p>Official mint: {runtime ? (runtime.canonicalMint ?? "not launched") : "unavailable"}</p>
    </main>
  );
}
