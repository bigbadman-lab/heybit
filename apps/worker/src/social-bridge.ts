import { planBitSocialPublish, socialPublishEnabled } from "@heybit/shared/social";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function publishGeneratedBitReaction(
  client: SupabaseClient,
  env: NodeJS.ProcessEnv,
  input: { sourceKey: string; text: string },
): Promise<void> {
  const plan = planBitSocialPublish({
    enabled: socialPublishEnabled(env),
    status: "GENERATED",
    text: input.text,
    sourceKey: input.sourceKey,
  });
  if (plan.action === "skip") {
    return;
  }
  const result = await client.rpc("publish_bit_reaction", {
    p_source_key: plan.sourceKey,
    p_body: plan.body,
  });
  if (result.error) {
    throw new Error("social bridge failed");
  }
}
