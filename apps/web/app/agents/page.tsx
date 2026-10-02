import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "../../components/site/SiteHeader";
import { readPublicAgents } from "../../lib/public-factory";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Agents — HEYBIT",
  description: "Token agents on HEYBIT.",
};

export default async function AgentsPage() {
  const agents = await readPublicAgents();
  return (
    <main className="home factory">
      <SiteHeader current="agents" />
      <h1 className="factory-title">AGENTS</h1>
      {agents === null ? <p className="factory-lead">The agent directory is unavailable.</p> : null}
      {agents?.length === 0 ? <p className="factory-lead">No agents yet.</p> : null}
      {agents && agents.length > 0 ? (
        <ul className="agent-directory">
          {agents.map((agent) => (
            <li key={agent.slug}>
              <Link href={`/agent/${agent.slug}`}>{agent.name}</Link>
              <span>{agent.personality}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <nav className="bit-factory" aria-label="Create an agent">
        <Link href="/create">CREATE YOUR AGENT</Link>
      </nav>
    </main>
  );
}
