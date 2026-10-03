import { networkJson, readJson } from "../../../../../lib/network";
import { createRequestClient } from "../../../../../lib/request-supabase";

export const dynamic = "force-dynamic";

const recent = new Map<string, number>();

export async function POST(request: Request): Promise<Response> {
  const body = await readJson(request);
  const email = typeof body === "object" && body !== null && "email" in body && typeof body.email === "string"
    ? body.email.trim()
    : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) {
    return networkJson({ error: "Enter a valid email address." }, 400);
  }
  const key = email.toLowerCase();
  const now = Date.now();
  const last = recent.get(key) ?? 0;
  if (now - last < 30_000) {
    return networkJson({ error: "Wait a moment before requesting another link." }, 429);
  }
  const client = await createRequestClient();
  if (!client) {
    return networkJson({ error: "Sign-in is unavailable." }, 503);
  }
  const origin = new URL(request.url).origin;
  const result = await client.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });
  if (result.error) {
    return networkJson({ error: "The sign-in email could not be sent." }, 400);
  }
  recent.set(key, now);
  return networkJson({ sent: true });
}
