import { revokeHumanSession } from "../../../../../lib/human-wallet-store";
import { readHumanSessionId } from "../../../../../lib/human-wallet";
import { clearHumanCookie, networkJson, readHumanCookieToken } from "../../../../../lib/network";

export const dynamic = "force-dynamic";

export async function POST(): Promise<Response> {
  const token = await readHumanCookieToken();
  const parsed = token ? readHumanSessionId(token) : null;
  if (parsed) {
    await revokeHumanSession(parsed.sessionId, Date.now());
  }
  await clearHumanCookie();
  return networkJson({ signedOut: true });
}
