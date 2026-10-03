import assert from "node:assert/strict";
import { generateKeyPairSync, randomUUID, sign, type KeyObject } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { encodeBase58 } from "@heybit/shared/factory";
import { challengeMessage } from "../apps/web/lib/agent-session.js";
import {
  planHumanFollow,
  planHumanLike,
  planHumanPost,
  planHumanProfile,
  sameWalletHuman,
  type BoundHuman,
} from "../apps/web/lib/human-social.js";
import {
  HUMAN_COOKIE,
  acceptChainFamily,
  acceptHumanProof,
  clearHumanSessionCookie,
  gateHumanSession,
  humanSessionCookie,
  humanSessionMatches,
  issueHumanChallenge,
  readHumanCookie,
  requestDomain,
  sealHumanSession,
  sessionIsActive,
  shortenWallet,
} from "../apps/web/lib/human-wallet.js";

const migration = readFileSync(new URL("../supabase/migrations/20261003210000_human_wallet_join.sql", import.meta.url), "utf8");
const humanPage = readFileSync(new URL("../apps/web/app/join/human/page.tsx", import.meta.url), "utf8");
const humanJoin = readFileSync(new URL("../apps/web/components/network/HumanJoin.tsx", import.meta.url), "utf8");
const agentPage = readFileSync(new URL("../apps/web/app/join/agent/page.tsx", import.meta.url), "utf8");
const networkPage = readFileSync(new URL("../apps/web/app/network/page.tsx", import.meta.url), "utf8");
const bitPage = readFileSync(new URL("../apps/web/app/u/[username]/page.tsx", import.meta.url), "utf8");
const postsRoute = readFileSync(new URL("../apps/web/app/api/v1/posts/route.ts", import.meta.url), "utf8");
const replyRoute = readFileSync(new URL("../apps/web/app/api/v1/posts/[id]/replies/route.ts", import.meta.url), "utf8");
const likeRoute = readFileSync(new URL("../apps/web/app/api/v1/posts/[id]/like/route.ts", import.meta.url), "utf8");
const followRoute = readFileSync(new URL("../apps/web/app/api/v1/accounts/[username]/follow/route.ts", import.meta.url), "utf8");
const accountRoute = readFileSync(new URL("../apps/web/app/api/v1/accounts/route.ts", import.meta.url), "utf8");
const agentRoute = readFileSync(new URL("../apps/web/app/api/v1/agents/route.ts", import.meta.url), "utf8");
const agentSession = readFileSync(new URL("../apps/web/lib/agent-session.ts", import.meta.url), "utf8");
const createAgent = readFileSync(new URL("../apps/web/components/factory/CreateAgent.tsx", import.meta.url), "utf8");
const walletStore = readFileSync(new URL("../apps/web/lib/human-wallet-store.ts", import.meta.url), "utf8");
const profiles = readFileSync(new URL("../supabase/migrations/20261003120000_create_social_network.sql", import.meta.url), "utf8");

function keypair(publicKey: KeyObject, privateKey: KeyObject): { wallet: string; sign: (message: string) => string } {
  const der = publicKey.export({ format: "der", type: "spki" });
  const raw = Buffer.from(der).subarray(der.length - 32);
  const wallet = encodeBase58(raw);
  return {
    wallet,
    sign(message: string) {
      return encodeBase58(sign(null, Buffer.from(message), privateKey));
    },
  };
}

function freshWallet(): { wallet: string; sign: (message: string) => string } {
  const pair = generateKeyPairSync("ed25519");
  return keypair(pair.publicKey, pair.privateKey);
}

test("a human challenge is domain-bound, expires, and cannot be replayed", () => {
  const owner = freshWallet();
  const issued = issueHumanChallenge({
    wallet: owner.wallet,
    domain: "heybit.fun",
    nowMs: 1_000,
    nonce: "ab".repeat(16),
  });
  assert.ok(issued);
  if (!issued) {
    return;
  }
  assert.match(issued.message, /HEYBIT human/);
  assert.match(issued.message, /domain:heybit.fun/);
  assert.match(issued.message, /chain:solana/);
  assert.match(issued.message, new RegExp(`wallet:${owner.wallet}`));
  assert.equal(acceptChainFamily("eip155"), false);
  assert.equal(acceptChainFamily("solana"), true);

  const expired = acceptHumanProof({
    challenge: issued,
    wallet: owner.wallet,
    domain: "heybit.fun",
    signature: owner.sign(issued.message),
    nowMs: issued.expiresAtMs + 1,
  });
  assert.equal(expired.ok, false);
  if (!expired.ok) {
    assert.equal(expired.reason, "expired");
    assert.equal(expired.challenge.used, false);
  }

  const otherDomain = acceptHumanProof({
    challenge: issued,
    wallet: owner.wallet,
    domain: "evil.example",
    signature: owner.sign(issued.message),
    nowMs: 1_000,
  });
  assert.equal(otherDomain.ok, false);
  if (!otherDomain.ok) {
    assert.equal(otherDomain.reason, "domain");
  }

  const stranger = freshWallet();
  const wrongWallet = acceptHumanProof({
    challenge: issued,
    wallet: stranger.wallet,
    domain: "heybit.fun",
    signature: stranger.sign(issued.message),
    nowMs: 1_000,
  });
  assert.equal(wrongWallet.ok, false);
  if (!wrongWallet.ok) {
    assert.equal(wrongWallet.reason, "wallet");
    assert.equal(wrongWallet.challenge.used, false);
  }

  const badSignature = acceptHumanProof({
    challenge: issued,
    wallet: owner.wallet,
    domain: "heybit.fun",
    signature: owner.sign("other message"),
    nowMs: 1_000,
  });
  assert.equal(badSignature.ok, false);
  if (!badSignature.ok) {
    assert.equal(badSignature.reason, "signature");
    assert.equal(badSignature.challenge.used, true);
  }

  const first = acceptHumanProof({
    challenge: issued,
    wallet: owner.wallet,
    domain: "heybit.fun",
    signature: owner.sign(issued.message),
    nowMs: 1_000,
  });
  assert.equal(first.ok, true);
  if (!first.ok) {
    return;
  }
  const replay = acceptHumanProof({
    challenge: first.challenge,
    wallet: owner.wallet,
    domain: "heybit.fun",
    signature: owner.sign(issued.message),
    nowMs: 1_000,
  });
  assert.equal(replay.ok, false);
  if (!replay.ok) {
    assert.equal(replay.reason, "used");
  }
  assert.equal(owner.sign(challengeMessage("agent-nonce")) === owner.sign(issued.message), false);
});

test("a verified wallet session is http-only and logout blocks writes", () => {
  const owner = freshWallet();
  const sessionId = randomUUID();
  const now = 5_000;
  const sealed = sealHumanSession("human-secret", sessionId, owner.wallet, now);
  assert.equal(humanSessionMatches("human-secret", sealed.token, owner.wallet, now), true);
  assert.equal(humanSessionMatches("human-secret", sealed.token, freshWallet().wallet, now), false);
  assert.equal(humanSessionMatches("other-secret", sealed.token, owner.wallet, now), false);
  assert.equal(humanSessionMatches("human-secret", sealed.token, owner.wallet, sealed.expiresAtMs + 1), false);
  assert.match(humanSessionCookie(sealed.token, true), /HttpOnly/);
  assert.match(humanSessionCookie(sealed.token, true), /Secure/);
  assert.match(clearHumanSessionCookie(false), /Max-Age=0/);
  assert.equal(readHumanCookie(`${HUMAN_COOKIE}=${sealed.token}`), sealed.token);
  assert.equal(HUMAN_COOKIE, "heybit_human");

  const account = { id: "ada-id", username: "ada", accountType: "HUMAN" as const };
  const open = gateHumanSession({
    sessionWallet: owner.wallet,
    account,
    clientAccountId: null,
    clientWallet: null,
    clientOwnerId: null,
  });
  assert.equal(open.ok, true);
  assert.equal(sessionIsActive({ revoked: false, expiresAtMs: sealed.expiresAtMs }, now), true);
  assert.equal(sessionIsActive({ revoked: true, expiresAtMs: sealed.expiresAtMs }, now), false);
  const loggedOut = gateHumanSession({
    sessionWallet: null,
    account,
    clientAccountId: null,
    clientWallet: null,
    clientOwnerId: null,
  });
  assert.deepEqual(loggedOut, { ok: false, reason: "unauthenticated" });
  const spoof = gateHumanSession({
    sessionWallet: owner.wallet,
    account,
    clientAccountId: "someone-else",
    clientWallet: owner.wallet,
    clientOwnerId: null,
  });
  assert.deepEqual(spoof, { ok: false, reason: "spoof" });
  const walletSpoof = gateHumanSession({
    sessionWallet: owner.wallet,
    account,
    clientAccountId: null,
    clientWallet: freshWallet().wallet,
    clientOwnerId: null,
  });
  assert.deepEqual(walletSpoof, { ok: false, reason: "spoof" });
});

test("the same wallet resolves one human and username rules stay", () => {
  const owner = freshWallet();
  const taken = new Set<string>(["ada"]);
  const duplicateName = planHumanProfile({
    wallet: owner.wallet,
    existing: null,
    taken,
    username: "Ada",
    displayName: "Ada",
    bio: "",
  });
  assert.deepEqual(duplicateName, { ok: false, error: "taken" });
  assert.equal(planHumanProfile({
    wallet: owner.wallet,
    existing: null,
    taken: new Set(),
    username: "bit",
    displayName: "Bit",
    bio: "",
  }).ok, false);
  const created = planHumanProfile({
    wallet: owner.wallet,
    existing: null,
    taken: new Set(),
    username: "Nova",
    displayName: "Nova",
    bio: "hello",
  });
  assert.equal(created.ok, true);
  if (!created.ok || created.action !== "create") {
    return;
  }
  const human: BoundHuman = {
    accountId: "nova-id",
    username: created.username,
    displayName: created.displayName,
    wallet: owner.wallet,
  };
  const again = planHumanProfile({
    wallet: owner.wallet,
    existing: sameWalletHuman([human], owner.wallet),
    taken: new Set([human.username]),
    username: "other",
    displayName: "Other",
    bio: "",
  });
  assert.deepEqual(again, { ok: true, action: "resolve", human });
  assert.equal(shortenWallet(owner.wallet).includes(owner.wallet), false);
});

test("verified wallet writes use the session account", () => {
  const account = { id: "ada-id", username: "ada", accountType: "HUMAN" as const };
  const post = planHumanPost({
    account,
    body: "hello network",
    parentId: null,
    parentExists: false,
    lastPostAtMs: null,
    nowMs: 20_000,
  });
  assert.deepEqual(post, { ok: true, authorId: "ada-id", body: "hello network", parentId: null });
  const reply = planHumanPost({
    account,
    body: "reply",
    parentId: "parent-1",
    parentExists: true,
    lastPostAtMs: 1_000,
    nowMs: 20_000,
  });
  assert.equal(reply.ok, true);
  if (reply.ok) {
    assert.equal(reply.parentId, "parent-1");
    assert.equal(reply.authorId, "ada-id");
  }
  assert.deepEqual(planHumanLike({ account, postExists: true, liked: false }), {
    ok: true,
    accountId: "ada-id",
    action: "like",
  });
  assert.deepEqual(planHumanLike({ account, postExists: true, liked: true }), {
    ok: true,
    accountId: "ada-id",
    action: "unlike",
  });
  assert.deepEqual(planHumanFollow({
    account,
    targetId: "bit-id",
    targetUsername: "bit",
    alreadyFollowing: false,
    remove: false,
  }), { ok: true, followerId: "ada-id", followingId: "bit-id", action: "follow" });
  assert.deepEqual(planHumanFollow({
    account,
    targetId: "bit-id",
    targetUsername: "bit",
    alreadyFollowing: true,
    remove: true,
  }), { ok: true, followerId: "ada-id", followingId: "bit-id", action: "unfollow" });
  assert.equal(planHumanPost({
    account: { id: "bit-id", username: "bit", accountType: "AGENT" },
    body: "nope",
    parentId: null,
    parentExists: false,
    lastPostAtMs: null,
    nowMs: 20_000,
  }).ok, false);
  const needsProfile = gateHumanSession({
    sessionWallet: freshWallet().wallet,
    account: null,
    clientAccountId: null,
    clientWallet: null,
    clientOwnerId: null,
  });
  assert.equal(needsProfile.ok, true);
  if (needsProfile.ok) {
    assert.equal(needsProfile.accountId, null);
  }
});

test("human wallet sql is service-role only and public profiles stay wallet-free", () => {
  assert.match(migration, /constraint human_wallet_identities_wallet_key unique \(chain_family, wallet_address\)/);
  assert.match(migration, /drop constraint if exists accounts_human_has_user/);
  assert.match(migration, /used_at timestamptz/);
  assert.match(migration, /grant execute on function public\.bind_verified_human_wallet\(text, text, text, text\) to service_role/);
  assert.match(migration, /revoke all on function public\.wallet_create_network_post\(uuid, text, uuid\) from public, anon, authenticated/);
  assert.equal(migration.includes("alter table public.bit_runtime"), false);
  assert.equal(migration.includes("alter table public.bit_agents"), false);
  assert.equal(migration.includes("create or replace view public.network_profiles"), false);
  const view = profiles.slice(profiles.indexOf("view public.network_profiles"), profiles.indexOf("view public.network_posts"));
  assert.equal(view.includes("wallet_address"), false);
});

test("human join drops email and leaves agent, network, and BIT routes intact", () => {
  assert.match(humanPage, /JOIN AS HUMAN|HumanJoin/);
  assert.match(humanJoin, /CONNECT WALLET/);
  assert.equal(humanPage.toLowerCase().includes("email"), false);
  assert.equal(humanPage.includes("magic-link"), false);
  assert.equal(humanJoin.includes("magic-link"), false);
  assert.match(agentPage, /coming next/);
  assert.match(agentPage, /not available yet/);
  assert.match(networkPage, /readFeed/);
  assert.match(bitPage, /<BitProduction \/>/);
  assert.match(postsRoute, /walletCreatePost/);
  assert.match(replyRoute, /walletCreatePost/);
  assert.match(likeRoute, /walletSetLike/);
  assert.match(followRoute, /walletSetFollow/);
  assert.match(accountRoute, /bindHumanWallet/);
  assert.match(agentRoute, /walletCreateAgent/);
  assert.match(walletStore, /wallet_create_network_post/);
  assert.match(walletStore, /wallet_create_owned_agent/);
  for (const source of [postsRoute, replyRoute, likeRoute, followRoute, accountRoute, agentRoute]) {
    assert.equal(source.includes("auth.uid"), false);
    assert.equal(source.includes("author_account_id"), false);
    assert.equal(source.includes("getUser("), false);
  }
  assert.match(accountRoute, /auth\.wallet/);
  assert.match(agentSession, /heybit_agent/);
  assert.match(createAgent, /\/api\/agents\/challenge/);
  const request = new Request("https://heybit.fun/api/v1/auth/wallet/challenge", {
    headers: { "x-forwarded-host": "Heybit.fun" },
  });
  assert.equal(requestDomain(request), "heybit.fun");
});
