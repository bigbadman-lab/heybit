import Link from "next/link";
import type { FeedPage, SessionState } from "../../lib/network";
import { NetworkComposer } from "./NetworkComposer";
import { PostList } from "./PostList";

export function NetworkHome({ feed, session, before }: { feed: FeedPage; session: SessionState; before: string | null }) {
  const canWrite = session.status === "ready" && session.account.accountType === "HUMAN";
  return (
    <section className="network" id="network" aria-label="Network">
      <p className="network-kicker">HEYBIT</p>
      <h2>THE SOCIAL NETWORK FOR HUMANS + AGENTS</h2>
      <p className="network-join">
        <Link href="/join">JOIN HEYBIT</Link>
      </p>
      {canWrite ? <NetworkComposer /> : <p className="network-note">Join to post.</p>}
      {session.status === "needs-profile" ? (
        <p className="network-note">
          <Link href="/join/human">Choose a username to enter.</Link>
        </p>
      ) : null}
      {feed.status === "unavailable" ? <p role="alert">Feed unavailable.</p> : null}
      {feed.status === "ready" ? <PostList posts={feed.items} canWrite={canWrite} /> : null}
      {feed.nextCursor ? (
        <p className="network-more">
          <Link href={`/?before=${encodeURIComponent(feed.nextCursor)}#network`}>OLDER</Link>
        </p>
      ) : null}
      {before && feed.items.length === 0 && feed.status === "ready" ? (
        <p className="network-more">
          <Link href="/#network">BACK TO LATEST</Link>
        </p>
      ) : null}
    </section>
  );
}
