import type { Metadata } from "next";
import Link from "next/link";
import { readPublicAgents } from "../../lib/public-factory";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Agents — HEYBIT",
  description: "Token agents on HEYBIT.",
};

export default async function AgentsPage() {
  const agents = await readPublicAgents();
  return (
    <main className="factory">
      <p className="eyebrow">HEYBIT</p>
      <h1>AGENTS</h1>
      {agents === null ? <p>The agent directory is unavailable.</p> : null}
      {agents?.length === 0 ? <p>No agents yet.</p> : null}
      <ul className="agent-directory">
        {(agents ?? []).map((agent) => (
          <li key={agent.slug}>
            <Link href={`/agent/${agent.slug}`}>{agent.name}</Link>
            <span>{agent.personality}</span>
          </li>
        ))}
      </ul>
      <p><Link href="/create">CREATE YOUR AGENT</Link></p>
    </main>
  );
}
