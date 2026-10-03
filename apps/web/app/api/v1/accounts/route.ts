import { bindHumanWallet } from "../../../../lib/human-wallet-store";
import { networkJson, profileInput, readJson, requireHumanActor, rpcFailure } from "../../../../lib/network";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const body = await readJson(request);
  const auth = await requireHumanActor(body, "session");
  if ("response" in auth) {
    return auth.response;
  }
  const input = profileInput(body, "HUMAN");
  if (!input.ok) {
    return input.response;
  }
  const result = await bindHumanWallet({
    wallet: auth.wallet,
    username: input.username,
    displayName: input.displayName,
    bio: input.bio,
  });
  if (result.error) {
    return rpcFailure(result.error);
  }
  return networkJson(result.data ?? { username: input.username });
}
