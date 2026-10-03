import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  applyLikeInsert,
  applyUnlike,
  authorizeHumanPost,
  claimUsername,
  commitBitBridge,
  decideFollow,
  isolateSocialPublish,
  nextLikeAction,
  planBitSocialPublish,
  socialPublishEnabled,
  validatePostBody,
  validateReplyParent,
} from "@heybit/shared/social";

const migration = readFileSync(new URL("../supabase/migrations/20261003120000_create_social_network.sql", import.meta.url), "utf8");
const bridge = readFileSync(new URL("../apps/worker/src/social-bridge.ts", import.meta.url), "utf8");
const store = readFileSync(new URL("../apps/worker/src/reaction-store.ts", import.meta.url), "utf8");
const postsRoute = readFileSync(new URL("../apps/web/app/api/v1/posts/route.ts", import.meta.url), "utf8");
const home = readFileSync(new URL("../apps/web/app/page.tsx", import.meta.url), "utf8");
const agentJoin = readFileSync(new URL("../apps/web/app/join/agent/page.tsx", import.meta.url), "utf8");
const postList = readFileSync(new URL("../apps/web/components/network/PostList.tsx", import.meta.url), "utf8");

test("human and agent usernames are unique, reserved, and case-insensitive", () => {
  const taken = new Set<string>();
  const human = claimUsername(taken, "Ada", { accountType: "HUMAN" });
  assert.equal(human.ok, true);
  if (human.ok) {
    taken.add(human.username);
  }
  const agent = claimUsername(taken, "sentry", { accountType: "AGENT" });
  assert.equal(agent.ok, true);
  assert.equal(claimUsername(taken, "ada", { accountType: "HUMAN" }).ok, false);
  assert.equal(claimUsername(taken, "ADA", { accountType: "AGENT" }).ok, false);
  assert.deepEqual(claimUsername(new Set(), "bit", { accountType: "HUMAN" }), { ok: false, error: "reserved" });
  assert.deepEqual(claimUsername(new Set(), "BIT", { accountType: "AGENT" }), { ok: false, error: "reserved" });
  const canonical = claimUsername(new Set(), "Bit", { accountType: "AGENT", canonicalBit: true });
  assert.deepEqual(canonical, { ok: true, username: "bit" });
  const again = claimUsername(new Set(["bit"]), "bit", { accountType: "AGENT", canonicalBit: true });
  assert.deepEqual(again, { ok: false, error: "taken" });
});

test("posts reject empty text, long text, and missing parents", () => {
  assert.equal(validatePostBody("  ").ok, false);
  assert.equal(validatePostBody("hello").ok, true);
  assert.equal(validatePostBody("x".repeat(501)).ok, false);
  assert.deepEqual(validateReplyParent(null, false), { ok: true });
  assert.deepEqual(validateReplyParent("missing", false), { ok: false, error: "invalid_parent" });
  assert.deepEqual(validateReplyParent("parent-1", true), { ok: true });
});

test("follows reject duplicates and self-follow", () => {
  assert.equal(decideFollow("a", "b", false), "follow");
  assert.equal(decideFollow("a", "b", true), "duplicate");
  assert.equal(decideFollow("a", "a", false), "self");
});

test("likes toggle and reject a second insert", () => {
  const likes = new Set<string>();
  assert.equal(nextLikeAction(false), "like");
  assert.equal(applyLikeInsert(likes, "a:post"), "inserted");
  assert.equal(applyLikeInsert(likes, "a:post"), "duplicate");
  assert.equal(nextLikeAction(true), "unlike");
  assert.equal(applyUnlike(likes, "a:post"), "removed");
  assert.equal(applyUnlike(likes, "a:post"), "missing");
});

test("BIT bridge publishes once, skips when disabled, and keeps the reaction on failure", async () => {
  const ready = planBitSocialPublish({
    enabled: true,
    status: "GENERATED",
    text: "noted.",
    sourceKey: "window-1",
  });
  const first = commitBitBridge([], ready);
  const second = commitBitBridge(first.posts, ready);
  assert.equal(first.published, true);
  assert.equal(second.duplicate, true);
  assert.equal(second.posts.length, 1);
  const disabled = planBitSocialPublish({ enabled: false, status: "GENERATED", text: "noted.", sourceKey: "window-1" });
  assert.equal(commitBitBridge([], disabled).published, false);
  assert.equal(socialPublishEnabled({}), false);
  assert.equal(socialPublishEnabled({ BIT_SOCIAL_PUBLISH_ENABLED: "false" }), false);
  assert.equal(socialPublishEnabled({ BIT_SOCIAL_PUBLISH_ENABLED: "true" }), true);
  const reaction = { text: "noted.", status: "GENERATED" };
  const failed = commitBitBridge([], ready, { fail: true });
  assert.equal(failed.failed, true);
  assert.equal(failed.posts.length, 0);
  assert.equal(reaction.text, "noted.");
  assert.equal(await isolateSocialPublish(async () => {
    throw new Error("social write failed");
  }), "failed");
});

test("writes require the session account and cannot spoof BIT", () => {
  const human = { id: "human-1", authUserId: "user-1", username: "ada", accountType: "HUMAN" as const };
  assert.deepEqual(authorizeHumanPost({ sessionUserId: null, account: human, clientAuthorId: null }), {
    ok: false,
    reason: "unauthenticated",
  });
  assert.deepEqual(authorizeHumanPost({ sessionUserId: "user-2", account: human, clientAuthorId: null }), {
    ok: false,
    reason: "unauthenticated",
  });
  assert.deepEqual(authorizeHumanPost({ sessionUserId: "user-1", account: human, clientAuthorId: "other" }), {
    ok: false,
    reason: "spoof",
  });
  assert.deepEqual(
    authorizeHumanPost({
      sessionUserId: "user-1",
      account: { id: "bit-1", authUserId: "user-1", username: "bit", accountType: "AGENT" },
      clientAuthorId: null,
    }),
    { ok: false, reason: "spoof" },
  );
  assert.deepEqual(authorizeHumanPost({ sessionUserId: "user-1", account: human, clientAuthorId: null }), {
    ok: true,
    authorId: "human-1",
  });
});

test("social SQL keeps BIT publishing on the service role and public rows narrow", () => {
  assert.match(migration, /username text not null/);
  assert.match(migration, /account_type in \('HUMAN', 'AGENT'\)/);
  assert.match(migration, /constraint follows_not_self/);
  assert.match(migration, /constraint post_likes_tuple_key unique \(account_id, post_id, reaction_type\)/);
  assert.match(migration, /reaction_source_key text primary key/);
  assert.match(migration, /values \('bit', 'BIT', 'AGENT'/);
  assert.match(migration, /revoke all on function public\.publish_bit_reaction\(text, text\) from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.publish_bit_reaction\(text, text\) to service_role/);
  assert.match(migration, /posting_too_quickly/);
  assert.match(migration, /Does not alter bit_runtime/);
  assert.equal(migration.includes("alter table public.bit_runtime"), false);
  assert.equal(migration.includes("alter table public.bit_reactions"), false);
  assert.equal(migration.includes("alter table public.bit_agents"), false);
  assert.equal(migration.includes("insert into public.bit_reactions"), false);
  const profiles = migration.slice(migration.indexOf("view public.network_profiles"), migration.indexOf("view public.network_posts"));
  assert.equal(profiles.includes("auth_user_id"), false);
  assert.equal(profiles.includes("callback_url"), false);
  assert.equal(profiles.includes("public_key"), false);
});

test("the bridge reuses stored reaction text and cannot break the reaction write", () => {
  const finish = store.slice(store.indexOf("async finish"));
  assert.ok(finish.indexOf(".upsert(") < finish.indexOf("afterGenerated"));
  assert.match(finish, /social bridge failed/);
  assert.match(bridge, /planBitSocialPublish/);
  assert.equal(bridge.includes("openai"), false);
  assert.equal(bridge.includes("OPENAI"), false);
  assert.equal(bridge.includes("callback"), false);
  assert.equal(postsRoute.includes("authorAccountId"), false);
  assert.match(postsRoute, /create_network_post/);
});

test("homepage keeps BIT and the agent preview does not claim the CLI exists", () => {
  assert.ok(home.indexOf("<BitPrompt />") < home.indexOf("<NetworkHome"));
  assert.match(home, /<BitProduction \/>/);
  assert.match(agentJoin, /coming next/);
  assert.match(agentJoin, /not available yet/);
  assert.equal(postList.includes("dangerouslySetInnerHTML"), false);
});
