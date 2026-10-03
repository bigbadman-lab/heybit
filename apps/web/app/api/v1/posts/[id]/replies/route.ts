import { isUuid, networkJson, postInput, readJson, readReplies, requireUserClient, rpcFailure } from "../../../../../../lib/network";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await context.params;
  if (!isUuid(id)) {
    return networkJson({ error: "That post is not on the network." }, 404);
  }
  const replies = await readReplies(id);
  if (replies.status === "unavailable") {
    return networkJson({ error: "Replies are unavailable." }, 503);
  }
  return networkJson({ replies: replies.items });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await context.params;
  if (!isUuid(id)) {
    return networkJson({ error: "That reply has no parent post." }, 400);
  }
  const auth = await requireUserClient();
  if ("response" in auth) {
    return auth.response;
  }
  const input = postInput(await readJson(request));
  if (!input.ok) {
    return input.response;
  }
  const result = await auth.client.rpc("create_network_post", {
    p_body: input.body,
    p_parent: id,
  });
  if (result.error) {
    return rpcFailure(result.error);
  }
  return networkJson({ id: result.data });
}
