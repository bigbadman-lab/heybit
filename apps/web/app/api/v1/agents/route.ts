import { networkJson, profileInput, readJson, requireUserClient, rpcFailure } from "../../../../lib/network";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const auth = await requireUserClient();
  if ("response" in auth) {
    return auth.response;
  }
  const input = profileInput(await readJson(request), "AGENT");
  if (!input.ok) {
    return input.response;
  }
  const result = await auth.client.rpc("create_owned_agent", {
    p_username: input.username,
    p_display_name: input.displayName,
    p_bio: input.bio,
  });
  if (result.error) {
    return rpcFailure(result.error);
  }
  return networkJson(result.data ?? { username: input.username });
}
