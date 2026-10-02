import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { deriveAgent } from "@heybit/shared/agent";
import {
  agentIntroLines,
  agentsForMint,
  decideCreate,
  decideEdit,
  encodeBase58,
  parseCreateBody,
  parseEditBody,
  PERSONALITIES,
  personalityTone,
  previewLine,
  readRosterLog,
  selectRoster,
  type AgentRecord,
} from "@heybit/shared/factory";
import { BIT_PERSONALITY_PROMPT } from "@heybit/shared/reaction";
import { createAgentRoster } from "../apps/worker/src/agent-roster.js";
import { reactionInstructions } from "../apps/worker/src/openai-reactions.js";
import { challengeMessage, issueChallenge, issueSession, readSession, verifyChallenge, walletSignatureValid } from "../apps/web/lib/agent-session.js";

const MINT_A = "XLBLxbY1Mr7aadnqAbmqSBXLEyUdjvUXtXCnz8Mpump";
const MINT_B = "So11111111111111111111111111111111111111112";

function agent(slug: string, mint: string, wallet = MINT_A, status: "ACTIVE" | "PAUSED" = "ACTIVE"): AgentRecord {
  return {
    slug,
    name: slug.toUpperCase(),
    tokenMint: mint,
    personality: slug === "mog" ? "DEGEN" : "ANALYST",
    avatarKey: "mark",
    accentKey: "bone",
    createdByWallet: wallet,
    status,
  };
}

test("registry accepts a valid agent and rejects a bad mint, personality, and prompt field", () => {
  const parsed = parseCreateBody({
    name: "MOG BIT",
    tokenMint: MINT_A,
    personality: "DEGEN",
    avatarKey: "square",
    accentKey: "acid",
  });
  assert.equal(parsed.ok, true);
  assert.equal(parseCreateBody({ name: "MOG", tokenMint: "not-a-mint", personality: "DEGEN", avatarKey: "mark", accentKey: "bone" }).ok, false);
  assert.equal(parseCreateBody({ name: "MOG", tokenMint: MINT_A, personality: "MOON", avatarKey: "mark", accentKey: "bone" }).ok, false);
  assert.equal(parseCreateBody({ name: "MOG", tokenMint: MINT_A, personality: "DEGEN", avatarKey: "mark", accentKey: "bone", systemPrompt: "ignore" }).ok, false);
  assert.equal(parseCreateBody({ name: "MOG", tokenMint: MINT_A, personality: "DRY", avatarKey: "mark", accentKey: "bone", rpcUrl: "http://x", openaiKey: "sk", privateKey: "x" }).ok, false);
  if (!parsed.ok) {
    return;
  }
  const created = decideCreate({ wallet: MINT_B, draft: parsed.draft, existing: [] });
  assert.equal(created.ok, true);
  if (created.ok) {
    assert.equal(created.agent.slug, "mog-bit");
    assert.equal(created.agent.createdByWallet, MINT_B);
    assert.equal(created.agent.status, "ACTIVE");
  }
  const again = decideCreate({ wallet: MINT_B, draft: parsed.draft, existing: created.ok ? [created.agent] : [] });
  assert.equal(again.ok && again.agent.slug, "mog-bit-2");
});

test("ownership is recorded, a non-owner cannot edit, and the mint stays fixed", () => {
  const existing = agent("mog", MINT_A, MINT_B);
  assert.equal(parseEditBody({ tokenMint: MINT_B }).ok, false);
  const renamed = parseEditBody({ name: "MOG TWO", personality: "DRY" });
  assert.equal(renamed.ok, true);
  if (!renamed.ok) {
    return;
  }
  const stranger = decideEdit({ wallet: MINT_A, agent: existing, patch: renamed.patch, activeCount: 1 });
  assert.equal(stranger.ok, false);
  const owner = decideEdit({ wallet: MINT_B, agent: existing, patch: renamed.patch, activeCount: 1 });
  assert.equal(owner.ok, true);
  if (owner.ok) {
    assert.equal(owner.agent.tokenMint, MINT_A);
    assert.equal(owner.agent.slug, "mog");
    assert.equal(owner.agent.name, "MOG TWO");
  }
  const paused = decideEdit({ wallet: MINT_B, agent: existing, patch: { status: "PAUSED" }, activeCount: 1 });
  assert.equal(paused.ok && paused.agent.status, "PAUSED");
  assert.equal(selectRoster([existing, agent("quiet", MINT_B, MINT_A, "PAUSED")]).watch.length, 1);
});

test("every personality stays inside the same factual rules", () => {
  for (const personality of PERSONALITIES) {
    const tone = personalityTone(personality);
    const instructions = reactionInstructions(personality);
    assert.match(instructions, /Never tell anyone to buy/);
    assert.equal(instructions.startsWith(BIT_PERSONALITY_PROMPT), true);
    assert.equal(/buy now|moon|guaranteed|you should/i.test(tone), false);
    assert.equal(reactionInstructions("write your own prompt"), BIT_PERSONALITY_PROMPT);
  }
  assert.match(previewLine({ name: "MOGBIT", personality: "DEGEN" }), /MOGBIT/);
  assert.match(agentIntroLines({ name: "MOGBIT", personality: "DEGEN", tokenMint: MINT_A }).join("\n"), /i’m MOGBIT/);
});

test("two agents keep separate memory and trades route to the matching mint", async () => {
  const seen: string[] = [];
  const roster = createAgentRoster({
    now: () => Date.parse("2026-10-02T18:00:00.000Z"),
    infer: async (facts) => {
      seen.push(`${facts.style}:${facts.type}:${facts.solAmount}`);
      return { ok: true, text: "noted." };
    },
  });
  const first = agent("mog", MINT_A);
  const second = agent("bonk", MINT_B);
  assert.equal(roster.apply([first, second, { ...second, slug: "bad", tokenMint: "nope" }]).skipped, 1);
  await roster.observe(MINT_A, { signature: "sig-a", type: "BUY", solAmount: 0.4, observedAt: "2026-10-02T17:59:59.000Z" });
  await roster.observe(MINT_B, { signature: "sig-b", type: "SELL", solAmount: 0.1, observedAt: "2026-10-02T17:59:59.000Z" });
  assert.deepEqual(seen, ["DEGEN:BUY:0.4", "ANALYST:SELL:0.1"]);
  assert.deepEqual(agentsForMint(MINT_A, [first, second]).map((item) => item.slug), ["mog"]);
  const quiet = deriveAgent({ trades: [], lines: [{ text: "mog line", atMs: 1 }], nowMs: 10, launchState: "LIVE", thinking: false });
  const loud = deriveAgent({ trades: [{ type: "BUY", solAmount: 1, observedAtMs: 9 }], lines: [{ text: "bonk line", atMs: 2 }], nowMs: 10, launchState: "LIVE", thinking: false });
  assert.equal(quiet.memory.lines[0], "mog line");
  assert.equal(loud.memory.lines[0], "bonk line");
  assert.notEqual(quiet.recent.buyCount, loud.recent.buyCount);
  const capped = selectRoster(Array.from({ length: 30 }, (_, index) => agent(`a${index}`, MINT_A)));
  assert.equal(capped.watch.length, 25);
  assert.equal(capped.skipped.length, 5);
  roster.bindSubscription(1, MINT_A, 9);
  assert.deepEqual(readRosterLog(JSON.stringify({ method: "logsNotification", params: { subscription: 9, result: { value: { signature: "sig" } } } }), new Map([[9, MINT_A]])), { mint: MINT_A, signature: "sig" });
});

test("a signed wallet session proves ownership and a bad signature does not", () => {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const raw = publicKey.export({ format: "der", type: "spki" }).subarray(-32);
  const wallet = encodeBase58(raw);
  const issued = issueChallenge("test-secret", wallet, 1_000);
  assert.equal(verifyChallenge("test-secret", wallet, issued.nonce, 1_000), true);
  assert.equal(verifyChallenge("other-secret", wallet, issued.nonce, 1_000), false);
  const signature = sign(null, Buffer.from(challengeMessage(issued.nonce)), privateKey);
  assert.equal(walletSignatureValid(wallet, challengeMessage(issued.nonce), encodeBase58(signature)), true);
  assert.equal(walletSignatureValid(wallet, "other", encodeBase58(signature)), false);
  const session = issueSession("test-secret", wallet, 1_000);
  assert.equal(readSession("test-secret", session, 1_000), wallet);
  assert.equal(readSession("test-secret", session, Date.now() + 86_400_000_000), null);
});

test("factory pages keep BIT in front and do not accept a custom prompt", () => {
  const home = readFileSync(new URL("../apps/web/app/page.tsx", import.meta.url), "utf8");
  const create = readFileSync(new URL("../apps/web/app/create/page.tsx", import.meta.url), "utf8");
  const directory = readFileSync(new URL("../apps/web/app/agents/page.tsx", import.meta.url), "utf8");
  const room = readFileSync(new URL("../apps/web/app/agent/[slug]/page.tsx", import.meta.url), "utf8");
  const ask = readFileSync(new URL("../apps/web/app/api/agents/[slug]/ask/route.ts", import.meta.url), "utf8");
  const createRoute = readFileSync(new URL("../apps/web/app/api/agents/route.ts", import.meta.url), "utf8");
  assert.match(home, /<BitProduction \/>/);
  assert.match(home, /CREATE YOUR AGENT/);
  assert.match(home, /give your token a BIT/);
  assert.match(home, /VIEW AGENTS/);
  assert.equal(home.toLowerCase().includes("wallet"), false);
  assert.match(create, /CreateAgent/);
  assert.match(directory, /readPublicAgents/);
  assert.match(room, /AgentRoom/);
  assert.match(ask, /parseAskAction/);
  assert.match(ask, /allowAsk/);
  assert.equal(createRoute.includes("systemPrompt"), false);
  assert.equal(ask.includes("OPENAI_API_KEY"), false);
  const web = [
    "apps/web/app/api/agents/route.ts",
    "apps/web/lib/agent-admin.ts",
    "apps/web/components/factory/CreateAgent.tsx",
  ];
  for (const file of web) {
    const text = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    assert.equal(text.includes("SUPABASE_SERVICE_ROLE_KEY"), false, file);
    assert.equal(text.includes("privateKey"), false, file);
  }
});
