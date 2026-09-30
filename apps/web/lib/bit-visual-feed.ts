import "server-only";
import { mapFeedRows, type VisualSource } from "../components/bit/bit-visual";
import { createPublicServerClient } from "./public-supabase";

/** Read-only visual cues. Missing access or a missing view settles to no source. */
export async function readBitVisualFeed(): Promise<VisualSource | null> {
  try {
    const client = createPublicServerClient();
    const result = await client
      .from("bit_visual_feed")
      .select("cue_id, kind, observed_at")
      .order("observed_at", { ascending: false })
      .limit(20);
    if (result.error || !result.data) {
      return null;
    }
    return mapFeedRows(result.data);
  } catch {
    return null;
  }
}
