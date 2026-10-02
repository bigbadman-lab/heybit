import type { Metadata } from "next";
import Link from "next/link";
import { AgentRoom } from "../../../components/factory/AgentRoom";
import { readPublicAgentProfile } from "../../../lib/public-factory";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const profile = await readPublicAgentProfile(slug);
  return { title: profile ? `${profile.name} — HEYBIT` : "Agent — HEYBIT" };
}

export default async function AgentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = await readPublicAgentProfile(slug);
  return (
    <main className="factory">
      <p className="eyebrow"><Link href="/">HEYBIT</Link></p>
      {profile ? <AgentRoom profile={profile} /> : <p>This agent is not available.</p>}
    </main>
  );
}
