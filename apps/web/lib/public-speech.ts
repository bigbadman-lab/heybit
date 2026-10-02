import "server-only";
import { createPublicServerClient } from "./public-supabase";

/** Latest stored BIT line. Missing access settles to no speech. */
export async function readPublicSpeech(): Promise<string | null> {
  try {
    const client = createPublicServerClient();
    const result = await client.from("bit_public_speech").select("text").limit(1).maybeSingle();
    if (result.error || typeof result.data?.text !== "string") {
      return null;
    }
    const text = result.data.text.trim();
    return text === "" ? null : text;
  } catch {
    return null;
  }
}
