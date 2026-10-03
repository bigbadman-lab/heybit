import { isUuid, networkJson, requireUserClient, rpcFailure } from "../../../../../../lib/network";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  return setLike(context, "like_network_post", true);
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  return setLike(context, "unlike_network_post", false);
}

async function setLike(
  context: { params: Promise<{ id: string }> },
  fn: "like_network_post" | "unlike_network_post",
  liked: boolean,
): Promise<Response> {
  const { id } = await context.params;
  if (!isUuid(id)) {
    return networkJson({ error: "That post is not on the network." }, 404);
  }
  const auth = await requireUserClient();
  if ("response" in auth) {
    return auth.response;
  }
  const result = await auth.client.rpc(fn, { p_post_id: id });
  if (result.error) {
    return rpcFailure(result.error);
  }
  return networkJson({ liked });
}
