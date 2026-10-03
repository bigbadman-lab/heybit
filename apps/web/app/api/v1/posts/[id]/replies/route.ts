import { walletCreatePost } from "../../../../../../lib/human-wallet-store";
import { isUuid, networkJson, postInput, readJson, readReplies, requireHumanActor, rpcFailure } from "../../../../../../lib/network";

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
  const body = await readJson(request);
  const auth = await requireHumanActor(body, "writer");
  if ("response" in auth || !auth.accountId) {
    return "response" in auth ? auth.response : networkJson({ error: "Choose a username before doing that." }, 409);
  }
  const input = postInput(body);
  if (!input.ok) {
    return input.response;
  }
  const result = await walletCreatePost(auth.accountId, input.body, id);
  if (result.error) {
    return rpcFailure(result.error);
  }
  return networkJson({ id: result.data });
}
