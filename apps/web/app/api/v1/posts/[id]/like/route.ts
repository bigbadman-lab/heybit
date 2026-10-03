import { walletSetLike } from "../../../../../../lib/human-wallet-store";
import { isUuid, networkJson, requireHumanActor, rpcFailure } from "../../../../../../lib/network";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  return setLike(context, true);
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  return setLike(context, false);
}

async function setLike(
  context: { params: Promise<{ id: string }> },
  like: boolean,
): Promise<Response> {
  const { id } = await context.params;
  if (!isUuid(id)) {
    return networkJson({ error: "That post is not on the network." }, 404);
  }
  const auth = await requireHumanActor(null, "writer");
  if ("response" in auth || !auth.accountId) {
    return "response" in auth ? auth.response : networkJson({ error: "Choose a username before doing that." }, 409);
  }
  const result = await walletSetLike(auth.accountId, id, like);
  if (result.error) {
    return rpcFailure(result.error);
  }
  return networkJson({ liked: like });
}
