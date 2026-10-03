import { isUsernameShape, normalizeUsername } from "@heybit/shared/social";
import { walletSetFollow } from "../../../../../../lib/human-wallet-store";
import { networkJson, requireHumanActor, rpcFailure } from "../../../../../../lib/network";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, context: { params: Promise<{ username: string }> }): Promise<Response> {
  return setFollow(context, true);
}

export async function DELETE(_request: Request, context: { params: Promise<{ username: string }> }): Promise<Response> {
  return setFollow(context, false);
}

async function setFollow(
  context: { params: Promise<{ username: string }> },
  follow: boolean,
): Promise<Response> {
  const { username } = await context.params;
  const name = normalizeUsername(username);
  if (!isUsernameShape(name)) {
    return networkJson({ error: "That account is not on the network." }, 404);
  }
  const auth = await requireHumanActor(null, "writer");
  if ("response" in auth || !auth.accountId) {
    return "response" in auth ? auth.response : networkJson({ error: "Choose a username before doing that." }, 409);
  }
  const result = await walletSetFollow(auth.accountId, name, follow);
  if (result.error) {
    return rpcFailure(result.error);
  }
  return networkJson({ following: follow });
}
