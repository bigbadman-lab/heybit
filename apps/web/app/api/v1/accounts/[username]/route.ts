import { isUsernameShape, normalizeUsername } from "@heybit/shared/social";
import { networkJson, readAccountPosts, readProfile } from "../../../../../lib/network";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ username: string }> }): Promise<Response> {
  const { username } = await context.params;
  const name = normalizeUsername(username);
  if (!isUsernameShape(name)) {
    return networkJson({ error: "That account is not on the network." }, 404);
  }
  const profile = await readProfile(name);
  if (profile.status === "unavailable") {
    return networkJson({ error: "That profile is unavailable." }, 503);
  }
  if (profile.status === "missing") {
    return networkJson({ error: "That account is not on the network." }, 404);
  }
  const posts = await readAccountPosts(name, null);
  return networkJson({ account: profile.profile, posts: posts.items, nextCursor: posts.nextCursor });
}
