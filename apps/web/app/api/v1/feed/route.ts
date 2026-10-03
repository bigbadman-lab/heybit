import { parseFeedFilter } from "@heybit/shared/social";
import { networkJson, parseFeedCursor, readFeed } from "../../../../lib/network";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const before = parseFeedCursor(url.searchParams.get("before"));
  const feed = await readFeed(before, parseFeedFilter(url.searchParams.get("kind")));
  if (feed.status === "unavailable") {
    return networkJson({ error: "The feed is unavailable." }, 503);
  }
  return networkJson({ posts: feed.items, nextCursor: feed.nextCursor });
}
