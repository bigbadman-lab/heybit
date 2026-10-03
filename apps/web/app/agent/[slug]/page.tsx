import type { Metadata } from "next";
import { AgentRoom } from "../../../components/factory/AgentRoom";
import { SiteHeader } from "../../../components/site/SiteHeader";
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
    <main className="home factory">
      <SiteHeader current="agents" />
      {profile ? <AgentRoom profile={profile} /> : <p className="factory-lead">This agent is not available.</p>}
    </main>
  );
}
