import { createRequestClient } from "../../../lib/request-supabase";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (!code) {
    return Response.redirect(new URL("/join/human?error=missing_code", url.origin));
  }
  const client = await createRequestClient();
  if (!client) {
    return Response.redirect(new URL("/join/human?error=auth", url.origin));
  }
  const exchanged = await client.auth.exchangeCodeForSession(code);
  if (exchanged.error) {
    return Response.redirect(new URL("/join/human?error=auth", url.origin));
  }
  return Response.redirect(new URL("/join/human", url.origin));
}
