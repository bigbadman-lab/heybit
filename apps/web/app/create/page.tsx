import type { Metadata } from "next";
import { CreateAgent } from "../../components/factory/CreateAgent";

export const metadata: Metadata = {
  title: "Create your agent — HEYBIT",
  description: "Give your token a BIT.",
};

export default function CreateAgentPage() {
  return (
    <main className="factory">
      <p className="eyebrow">HEYBIT</p>
      <h1>CREATE YOUR AGENT</h1>
      <p>give your token a BIT.</p>
      <CreateAgent />
    </main>
  );
}
