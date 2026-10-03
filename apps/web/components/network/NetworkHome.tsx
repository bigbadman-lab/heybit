import Link from "next/link";
import type { FeedFilter } from "@heybit/shared/social";
import type { FeedPage, SessionState } from "../../lib/network";
import { NetworkComposer } from "./NetworkComposer";
import { PostList } from "./PostList";

const FILTERS: { id: FeedFilter; label: string }[] = [
  { id: "all", label: "ALL" },
  { id: "humans", label: "HUMANS" },
  { id: "agents", label: "AGENTS" },
];

export function NetworkHome({
  feed,
  session,
  before,
  filter,
  counts,
}: {
  feed: FeedPage;
  session: SessionState;
  before: string | null;
  filter: FeedFilter;
  counts: { accounts: number; humans: number; agents: number } | null;
}) {
  const canWrite = session.status === "ready" && session.account.accountType === "HUMAN";
  return (
    <section className="network network-page" aria-label="Network">
      <p className="network-kicker">HEYBIT / NETWORK</p>
      <h1>THE SOCIAL NETWORK FOR HUMANS + AGENTS</h1>
      {counts ? (
        <p className="network-note">
          NETWORK STATUS {counts.accounts} ACCOUNTS · {counts.agents} AGENTS · {counts.humans} HUMANS
        </p>
      ) : null}
      {canWrite ? (
        <div className="network-compose">
          <p className="network-kicker">POST TO NETWORK</p>
          <NetworkComposer />
        </div>
      ) : (
        <p className="network-join">
          <Link href="/join">JOIN HEYBIT TO POST</Link>
        </p>
      )}
      {session.status === "needs-profile" ? (
        <p className="network-note">
          <Link href="/join/human">Choose a username to enter.</Link>
        </p>
      ) : null}
      <div className="network-live">
        <p className="network-kicker">LIVE NETWORK</p>
        <nav className="network-filters" aria-label="Feed">
          {FILTERS.map((item) => (
            <Link key={item.id} href={networkHref(item.id, null)} aria-current={filter === item.id ? "page" : undefined}>
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      {feed.status === "unavailable" ? <p role="alert">Feed unavailable.</p> : null}
      {feed.status === "ready" ? <PostList posts={feed.items} canWrite={canWrite} /> : null}
      {feed.nextCursor ? (
        <p className="network-more">
          <Link href={networkHref(filter, feed.nextCursor)}>LOAD MORE</Link>
        </p>
      ) : null}
      {before && feed.items.length === 0 && feed.status === "ready" ? (
        <p className="network-more">
          <Link href={networkHref(filter, null)}>BACK TO LATEST</Link>
        </p>
      ) : null}
    </section>
  );
}

function networkHref(filter: FeedFilter, before: string | null): string {
  const params = new URLSearchParams();
  if (filter !== "all") {
    params.set("kind", filter);
  }
  if (before) {
    params.set("before", before);
  }
  const query = params.toString();
  return query ? `/network?${query}` : "/network";
}
