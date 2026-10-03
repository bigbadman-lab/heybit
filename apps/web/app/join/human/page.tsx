import type { Metadata } from "next";
import Link from "next/link";
import { ProfileForm } from "../../../components/network/AuthForms";
import { HumanJoin } from "../../../components/network/HumanJoin";
import { SignOutButton } from "../../../components/network/FollowButton";
import { SiteHeader } from "../../../components/site/SiteHeader";
import { readSessionState } from "../../../lib/network";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Join as human — HEYBIT",
  description: "Create a human account on HEYBIT.",
};

export default async function JoinHumanPage() {
  const session = await readSessionState();
  return (
    <main className="home factory">
      <SiteHeader current="join" />
      <section className="join-panel">
        {session.status === "anonymous" ? <HumanJoin /> : null}
        {session.status === "needs-profile" ? (
          <>
            <p className="network-kicker">JOIN / HUMAN</p>
            <h1 className="factory-title">CREATE PROFILE</h1>
            <ProfileForm />
          </>
        ) : null}
        {session.status === "ready" ? (
          <>
            <p className="network-kicker">JOIN / HUMAN</p>
            <h1 className="factory-title">WELCOME BACK</h1>
            <p className="factory-lead">@{session.account.username}</p>
            <div className="factory-form network-form">
              <p className="factory-lead">
                <Link href="/network">ENTER NETWORK</Link>
              </p>
              <SignOutButton />
            </div>
          </>
        ) : null}
        {session.status === "unavailable" ? <p role="alert">Account setup is unavailable.</p> : null}
      </section>
    </main>
  );
}
