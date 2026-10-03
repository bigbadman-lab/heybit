import { walletCreatePost } from "../../../../lib/human-wallet-store";
import { networkJson, postInput, readJson, requireHumanActor, rpcFailure } from "../../../../lib/network";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const body = await readJson(request);
  const auth = await requireHumanActor(body, "writer");
  if ("response" in auth || !auth.accountId) {
    return "response" in auth ? auth.response : networkJson({ error: "Choose a username before doing that." }, 409);
  }
  const input = postInput(body);
  if (!input.ok) {
    return input.response;
  }
  const result = await walletCreatePost(auth.accountId, input.body, null);
  if (result.error) {
    return rpcFailure(result.error);
  }
  return networkJson({ id: result.data });
}
