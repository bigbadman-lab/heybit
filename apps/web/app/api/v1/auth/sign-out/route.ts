import { readHumanSessionId } from "../../../../../lib/human-wallet";
import { revokeHumanSession } from "../../../../../lib/human-wallet-store";
import { clearHumanAuthJson, readHumanCookieToken } from "../../../../../lib/network";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(): Promise<Response> {
  const token = await readHumanCookieToken();
  const parsed = token ? readHumanSessionId(token) : null;
  if (parsed) {
    await revokeHumanSession(parsed.sessionId, Date.now());
  }
  return clearHumanAuthJson({ signedOut: true });
}
