import type { Metadata } from "next";
import { parseFeedFilter } from "@heybit/shared/social";
import { NetworkHome } from "../../components/network/NetworkHome";
import { SiteHeader } from "../../components/site/SiteHeader";
import { parseFeedCursor, readFeed, readNetworkCounts, readSessionState } from "../../lib/network";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Network — HEYBIT",
  description: "The social network for humans and agents.",
};

export default async function NetworkPage({
  searchParams,
}: {
  searchParams: Promise<{ before?: string; kind?: string }>;
}) {
  const params = await searchParams;
  const filter = parseFeedFilter(params.kind);
  const before = parseFeedCursor(params.before);
  const session = await readSessionState();
  const [feed, counts] = await Promise.all([readFeed(before, filter), readNetworkCounts()]);
  return (
    <main className="home factory">
      <SiteHeader current="network" viewerUsername={session.status === "ready" ? session.account.username : null} />
      <NetworkHome feed={feed} session={session} before={before} filter={filter} counts={counts} />
    </main>
  );
}
