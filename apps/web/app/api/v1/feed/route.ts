import { networkJson, parseFeedCursor, readFeed } from "../../../../lib/network";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const before = parseFeedCursor(new URL(request.url).searchParams.get("before"));
  const feed = await readFeed(before);
  if (feed.status === "unavailable") {
    return networkJson({ error: "The feed is unavailable." }, 503);
  }
  return networkJson({ posts: feed.items, nextCursor: feed.nextCursor });
}
