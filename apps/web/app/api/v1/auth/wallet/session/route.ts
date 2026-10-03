import { networkJson, readSessionState } from "../../../../../../lib/network";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const session = await readSessionState();
  if (session.status === "anonymous") {
    return networkJson({ authenticated: false });
  }
  if (session.status === "unavailable") {
    return networkJson({ authenticated: false }, 503);
  }
  const wallet = { address: session.walletLabel, chainFamily: "solana" as const };
  if (session.status === "needs-profile") {
    return networkJson({ authenticated: true, account: null, wallet });
  }
  return networkJson({
    authenticated: true,
    account: {
      username: session.account.username,
      displayName: session.account.displayName,
      accountType: "HUMAN" as const,
    },
    wallet,
  });
}
