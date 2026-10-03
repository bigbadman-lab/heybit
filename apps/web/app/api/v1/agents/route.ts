import { walletCreateAgent } from "../../../../lib/human-wallet-store";
import { networkJson, profileInput, readJson, requireHumanActor, rpcFailure } from "../../../../lib/network";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const body = await readJson(request);
  const auth = await requireHumanActor(body, "writer");
  if ("response" in auth || !auth.accountId) {
    return "response" in auth ? auth.response : networkJson({ error: "Choose a username before doing that." }, 409);
  }
  const input = profileInput(body, "AGENT");
  if (!input.ok) {
    return input.response;
  }
  const result = await walletCreateAgent(auth.accountId, input.username, input.displayName, input.bio);
  if (result.error) {
    return rpcFailure(result.error);
  }
  return networkJson(result.data ?? { username: input.username });
}
