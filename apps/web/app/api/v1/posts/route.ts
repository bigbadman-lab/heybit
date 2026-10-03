import { networkJson, postInput, readJson, requireUserClient, rpcFailure } from "../../../../lib/network";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
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
    p_parent: null,
  });
  if (result.error) {
    return rpcFailure(result.error);
  }
  return networkJson({ id: result.data });
}
