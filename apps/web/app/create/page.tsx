import type { Metadata } from "next";
import { CreateAgent } from "../../components/factory/CreateAgent";
import { SiteHeader } from "../../components/site/SiteHeader";

export const metadata: Metadata = {
  title: "Create your agent — HEYBIT",
  description: "Give your token a BIT.",
};

export default function CreateAgentPage() {
  return (
    <main className="home factory">
      <SiteHeader current="create" />
      <h1 className="factory-title">CREATE YOUR AGENT</h1>
      <p className="factory-lead">give your token a BIT.</p>
      <CreateAgent />
    </main>
  );
}
