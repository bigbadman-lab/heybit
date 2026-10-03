import { isUsernameShape, normalizeUsername } from "@heybit/shared/social";
import { networkJson, parseFeedCursor, readAccountPosts } from "../../../../../../lib/network";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ username: string }> }): Promise<Response> {
  const { username } = await context.params;
  const name = normalizeUsername(username);
  if (!isUsernameShape(name)) {
    return networkJson({ error: "That account is not on the network." }, 404);
  }
  const before = parseFeedCursor(new URL(request.url).searchParams.get("before"));
  const posts = await readAccountPosts(name, before);
  if (posts.status === "unavailable") {
    return networkJson({ error: "Posts are unavailable." }, 503);
  }
  return networkJson({ posts: posts.items, nextCursor: posts.nextCursor });
}
