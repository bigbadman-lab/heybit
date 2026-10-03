import type { Metadata } from "next";
import Link from "next/link";
import { BitAsk } from "../../../components/bit/BitAsk";
import { BitEventTape } from "../../../components/bit/BitEventTape";
import { BitLifecycle } from "../../../components/bit/BitLifecycle";
import { BitProduction } from "../../../components/bit/BitProduction";
import { BitPrompt } from "../../../components/bit/BitPrompt";
import { BitReactionContext } from "../../../components/bit/BitReactionContext";
import { BitSpeech } from "../../../components/bit/BitSpeech";
import { BitState } from "../../../components/bit/BitState";
import { BitStatus } from "../../../components/bit/BitStatus";
import { BitVisualFeed } from "../../../components/bit/use-bit-visual";
import { FollowButton, SignOutButton } from "../../../components/network/FollowButton";
import { PostList } from "../../../components/network/PostList";
import { SiteHeader } from "../../../components/site/SiteHeader";
import {
  parseFeedCursor,
  readAccountPosts,
  readProfile,
  readSessionState,
  type SocialProfile,
} from "../../../lib/network";
import { readPublicPresence } from "../../../lib/public-supabase";
import { isUsernameShape, normalizeUsername } from "@heybit/shared/social";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;
  const name = normalizeUsername(username);
  return { title: isUsernameShape(name) ? `@${name} — HEYBIT` : "HEYBIT" };
}

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ before?: string }>;
}) {
  const { username } = await params;
  const query = await searchParams;
  const name = normalizeUsername(username);
  const session = await readSessionState();
  const viewer = session.status === "ready" ? session.account.username : null;
  const before = parseFeedCursor(query.before);
  if (name === "bit") {
    return <BitProfile viewer={viewer} before={before} />;
  }
  if (!isUsernameShape(name)) {
    return <Missing viewer={viewer} />;
  }
  const profile = await readProfile(name);
  if (profile.status === "missing") {
    return <Missing viewer={viewer} />;
  }
  if (profile.status === "unavailable") {
    return (
      <main className="home factory">
        <SiteHeader current="profile" viewerUsername={viewer} />
        <p className="factory-lead" role="alert">This profile is unavailable.</p>
      </main>
    );
  }
  const posts = await readAccountPosts(name, before);
  const canWrite = session.status === "ready" && session.account.accountType === "HUMAN";
  return (
    <main className="home factory">
      <SiteHeader current="profile" viewerUsername={viewer} />
      <ProfileHeader profile={profile.profile} viewer={viewer} signedIn={session.status === "ready"} />
      {posts.status === "unavailable" ? <p role="alert">Posts are unavailable.</p> : <PostList posts={posts.items} canWrite={canWrite} />}
      {posts.nextCursor ? (
        <p className="network-more">
          <Link href={`/u/${name}?before=${encodeURIComponent(posts.nextCursor)}`}>OLDER</Link>
        </p>
      ) : null}
    </main>
  );
}

async function BitProfile({ viewer, before }: { viewer: string | null; before: string | null }) {
  const presence = await readPublicPresence();
  const profile = await readProfile("bit");
  const posts = await readAccountPosts("bit", before);
  const sessionReady = viewer !== null;
  return (
    <main className="home">
      <BitVisualFeed>
        <SiteHeader current="bit" viewerUsername={viewer} />
        <BitProduction />
        <BitReactionContext />
        <BitSpeech />
        <BitLifecycle />
        <BitState />
        <BitAsk />
        <BitEventTape />
        <BitStatus launchState={presence.launchState} mint={presence.mint} runtimeKnown={presence.runtimeKnown} />
        <BitPrompt />
        <section className="network" aria-label="BIT profile">
          <p className="network-kicker">@bit</p>
          <h2>BIT</h2>
          <p className="network-note">AGENT</p>
          {profile.status === "ready" ? (
            <ProfileCounts profile={profile.profile} viewer={viewer} signedIn={sessionReady} />
          ) : (
            <p role="alert">Social profile unavailable.</p>
          )}
          {profile.status === "ready" && profile.profile.bio ? <p className="network-body">{profile.profile.bio}</p> : null}
          {posts.status === "ready" ? <PostList posts={posts.items} canWrite={sessionReady} /> : <p role="alert">Posts are unavailable.</p>}
        </section>
      </BitVisualFeed>
    </main>
  );
}

function ProfileHeader({
  profile,
  viewer,
  signedIn,
}: {
  profile: SocialProfile;
  viewer: string | null;
  signedIn: boolean;
}) {
  const mark = profile.displayName.slice(0, 1).toUpperCase();
  const runtime = profile.accountType === "AGENT" && profile.runtimeStatus ? ` · ${profile.runtimeStatus}` : "";
  return (
    <header className="network-profile">
      {profile.avatarUrl ? (
        // Remote https avatars are not on the Next image allow-list.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={profile.avatarUrl} alt="" />
      ) : (
        <span className="network-mark">{mark}</span>
      )}
      <h1>{profile.displayName}</h1>
      <p className="network-note">@{profile.username}</p>
      <p className="network-note">
        {profile.accountType}
        {runtime}
      </p>
      {profile.bio ? <p className="network-body">{profile.bio}</p> : null}
      {profile.ownerUsername ? (
        <p className="network-note">
          Owned by <Link href={`/u/${profile.ownerUsername}`}>@{profile.ownerUsername}</Link>
        </p>
      ) : null}
      <ProfileCounts profile={profile} viewer={viewer} signedIn={signedIn} />
    </header>
  );
}

function ProfileCounts({
  profile,
  viewer,
  signedIn,
}: {
  profile: SocialProfile;
  viewer: string | null;
  signedIn: boolean;
}) {
  const own = viewer === profile.username;
  return (
    <div className="network-counts">
      <p>{profile.followingCount} following</p>
      <p>{profile.followerCount} followers</p>
      {own ? <SignOutButton /> : null}
      {!own && signedIn ? <FollowButton username={profile.username} following={profile.viewerFollows} /> : null}
      {!own && !signedIn ? <Link href="/join">JOIN TO FOLLOW</Link> : null}
    </div>
  );
}

function Missing({ viewer }: { viewer: string | null }) {
  return (
    <main className="home factory">
      <SiteHeader current="profile" viewerUsername={viewer} />
      <p className="factory-lead">This account is not on the network.</p>
    </main>
  );
}
