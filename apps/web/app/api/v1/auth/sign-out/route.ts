import { networkJson } from "../../../../../lib/network";
import { createRequestClient } from "../../../../../lib/request-supabase";

export const dynamic = "force-dynamic";

export async function POST(): Promise<Response> {
  const client = await createRequestClient();
  if (!client) {
    return networkJson({ error: "Sign-out is unavailable." }, 503);
  }
  await client.auth.signOut();
  return networkJson({ signedOut: true });
}
