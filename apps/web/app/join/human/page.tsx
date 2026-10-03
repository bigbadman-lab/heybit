import type { Metadata } from "next";
import Link from "next/link";
import { EmailForm, ProfileForm } from "../../../components/network/AuthForms";
import { SiteHeader } from "../../../components/site/SiteHeader";
import { readSessionState } from "../../../lib/network";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Join as human — HEYBIT",
  description: "Create a human account on HEYBIT.",
};

export default async function JoinHumanPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await readSessionState();
  const params = await searchParams;
  const authError = params.error === "auth" || params.error === "missing_code"
    ? "That sign-in link is invalid or expired."
    : null;
  const viewer = session.status === "ready" ? session.account.username : null;
  return (
    <main className="home factory">
      <SiteHeader current="join" viewerUsername={viewer} />
      <p className="network-kicker">HUMAN</p>
      <h1 className="factory-title">JOIN HEYBIT</h1>
      {authError ? <p role="alert">{authError}</p> : null}
      {session.status === "ready" ? (
        <p className="factory-lead">
          You are @{session.account.username}. <Link href={`/u/${session.account.username}`}>Enter the network.</Link>
        </p>
      ) : null}
      {session.status === "needs-profile" ? <ProfileForm /> : null}
      {session.status === "anonymous" ? <EmailForm /> : null}
      {session.status === "unavailable" ? <p role="alert">Account setup is unavailable.</p> : null}
    </main>
  );
}
