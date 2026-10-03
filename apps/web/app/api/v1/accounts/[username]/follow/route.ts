import { isUsernameShape, normalizeUsername } from "@heybit/shared/social";
import { networkJson, requireUserClient, rpcFailure } from "../../../../../../lib/network";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, context: { params: Promise<{ username: string }> }): Promise<Response> {
  return setFollow(context, "follow_network_account");
}

export async function DELETE(_request: Request, context: { params: Promise<{ username: string }> }): Promise<Response> {
  return setFollow(context, "unfollow_network_account");
}

async function setFollow(
  context: { params: Promise<{ username: string }> },
  fn: "follow_network_account" | "unfollow_network_account",
): Promise<Response> {
  const { username } = await context.params;
  const name = normalizeUsername(username);
  if (!isUsernameShape(name)) {
    return networkJson({ error: "That account is not on the network." }, 404);
  }
  const auth = await requireUserClient();
  if ("response" in auth) {
    return auth.response;
  }
  const result = await auth.client.rpc(fn, { p_username: name });
  if (result.error) {
    return rpcFailure(result.error);
  }
  return networkJson({ following: fn === "follow_network_account" });
}
