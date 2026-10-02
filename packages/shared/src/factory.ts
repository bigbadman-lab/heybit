import { isCanonicalMint } from "./index.js";

export const PERSONALITIES = ["DEADPAN", "DEGEN", "ANALYST", "CHAOTIC", "PARANOID", "DRY"] as const;
export const AVATARS = ["mark", "square", "ring"] as const;
export const ACCENTS = ["bone", "acid", "signal", "ember"] as const;
export const AGENT_STATUSES = ["ACTIVE", "PAUSED"] as const;
export const MAX_ACTIVE_AGENTS = 25;
export const MAX_AGENTS_PER_WALLET = 3;
export const AGENT_NAME_MAX = 24;

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const CREATE_KEYS = ["name", "tokenMint", "personality", "avatarKey", "accentKey"] as const;
const EDIT_KEYS = ["name", "personality", "avatarKey", "accentKey", "status"] as const;

export type Personality = (typeof PERSONALITIES)[number];
export type AvatarKey = (typeof AVATARS)[number];
export type AccentKey = (typeof ACCENTS)[number];
export type AgentStatus = (typeof AGENT_STATUSES)[number];

export interface AgentDraft {
  name: string;
  tokenMint: string;
  personality: Personality;
  avatarKey: AvatarKey;
  accentKey: AccentKey;
}

export interface AgentRecord {
  slug: string;
  name: string;
  tokenMint: string;
  personality: Personality;
  avatarKey: AvatarKey;
  accentKey: AccentKey;
  createdByWallet: string;
  status: AgentStatus;
}

export interface PublicAgentProfile {
  slug: string;
  name: string;
  tokenMint: string;
  personality: Personality;
  avatarKey: AvatarKey;
  accentKey: AccentKey;
  status: AgentStatus;
  createdAt: string | null;
}

const TONE: Record<Personality, string> = {
  DEADPAN: "Sound dry, understated, and concise.",
  DEGEN: "Sound crypto-native and playful. Stay factual. Do not promote.",
  ANALYST: "Sound calm, factual, and data-first.",
  CHAOTIC: "Sound energetic, but stay fact-bound.",
  PARANOID: "Sound suspicious of patterns. Never invent a pattern that is not in the facts.",
  DRY: "Sound minimal, terminal-like, and sardonic.",
};

export function encodeBase58(bytes: Uint8Array): string {
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) {
    zeros += 1;
  }
  const digits = [0];
  for (let index = zeros; index < bytes.length; index += 1) {
    let carry = bytes[index] ?? 0;
    for (let digit = 0; digit < digits.length; digit += 1) {
      carry += (digits[digit] ?? 0) << 8;
      digits[digit] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }
  let out = "1".repeat(zeros);
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    out += BASE58[digits[index] ?? 0];
  }
  return out;
}

export function decodeBase58(value: string): Uint8Array | null {
  if (!/^[1-9A-HJ-NP-Za-km-z]+$/.test(value)) {
    return null;
  }
  const bytes = [0];
  for (const char of value) {
    let carry = BASE58.indexOf(char);
    if (carry < 0) {
      return null;
    }
    for (let index = 0; index < bytes.length; index += 1) {
      carry += (bytes[index] ?? 0) * 58;
      bytes[index] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  for (const char of value) {
    if (char !== "1") {
      break;
    }
    bytes.push(0);
  }
  return Uint8Array.from(bytes.reverse());
}

export function isPersonality(value: unknown): value is Personality {
  return PERSONALITIES.some((item) => item === value);
}

export function isAvatar(value: unknown): value is AvatarKey {
  return AVATARS.some((item) => item === value);
}

export function isAccent(value: unknown): value is AccentKey {
  return ACCENTS.some((item) => item === value);
}

export function isAgentStatus(value: unknown): value is AgentStatus {
  return AGENT_STATUSES.some((item) => item === value);
}

export function personalityTone(personality: Personality): string {
  return TONE[personality];
}

export function validateAgentName(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const name = value.trim().replace(/\s+/g, " ");
  if (name.length < 1 || name.length > AGENT_NAME_MAX) {
    return null;
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9 .'-]*$/.test(name)) {
    return null;
  }
  return name;
}

export function slugFromName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/['.]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return slug;
}

export function uniqueSlug(base: string, taken: ReadonlySet<string>): string | null {
  if (base === "") {
    return null;
  }
  if (!taken.has(base)) {
    return base;
  }
  for (let index = 2; index <= 50; index += 1) {
    const candidate = `${base}-${index}`.slice(0, 40);
    if (!taken.has(candidate)) {
      return candidate;
    }
  }
  return null;
}

export function parseCreateBody(body: unknown): { ok: true; draft: AgentDraft } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, error: "Invalid request." };
  }
  const record = body as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!CREATE_KEYS.some((allowed) => allowed === key)) {
      return { ok: false, error: "Unexpected field." };
    }
  }
  const name = validateAgentName(record.name);
  if (!name) {
    return { ok: false, error: "Name is invalid." };
  }
  if (!isCanonicalMint(record.tokenMint)) {
    return { ok: false, error: "Mint is invalid." };
  }
  if (!isPersonality(record.personality)) {
    return { ok: false, error: "Personality is invalid." };
  }
  if (!isAvatar(record.avatarKey) || !isAccent(record.accentKey)) {
    return { ok: false, error: "Visual identity is invalid." };
  }
  return {
    ok: true,
    draft: {
      name,
      tokenMint: record.tokenMint,
      personality: record.personality,
      avatarKey: record.avatarKey,
      accentKey: record.accentKey,
    },
  };
}

export function decideCreate(input: {
  wallet: string;
  draft: AgentDraft;
  existing: readonly AgentRecord[];
}): { ok: true; agent: AgentRecord } | { ok: false; error: string } {
  if (!isCanonicalMint(input.wallet)) {
    return { ok: false, error: "Wallet is invalid." };
  }
  const owned = input.existing.filter((agent) => agent.createdByWallet === input.wallet);
  if (owned.length >= MAX_AGENTS_PER_WALLET) {
    return { ok: false, error: "This wallet already has 3 agents." };
  }
  const active = input.existing.filter((agent) => agent.status === "ACTIVE");
  if (active.length >= MAX_ACTIVE_AGENTS) {
    return { ok: false, error: "The factory is at its active agent cap." };
  }
  const slug = uniqueSlug(slugFromName(input.draft.name), new Set(input.existing.map((agent) => agent.slug)));
  if (!slug) {
    return { ok: false, error: "Name cannot become a slug." };
  }
  return {
    ok: true,
    agent: {
      slug,
      name: input.draft.name,
      tokenMint: input.draft.tokenMint,
      personality: input.draft.personality,
      avatarKey: input.draft.avatarKey,
      accentKey: input.draft.accentKey,
      createdByWallet: input.wallet,
      status: "ACTIVE",
    },
  };
}

export function parseEditBody(body: unknown): { ok: true; patch: Partial<Pick<AgentRecord, "name" | "personality" | "avatarKey" | "accentKey" | "status">> } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, error: "Invalid request." };
  }
  const record = body as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!EDIT_KEYS.some((allowed) => allowed === key)) {
      return { ok: false, error: "Unexpected field." };
    }
  }
  const patch: Partial<Pick<AgentRecord, "name" | "personality" | "avatarKey" | "accentKey" | "status">> = {};
  if ("name" in record) {
    const name = validateAgentName(record.name);
    if (!name) {
      return { ok: false, error: "Name is invalid." };
    }
    patch.name = name;
  }
  if ("personality" in record) {
    if (!isPersonality(record.personality)) {
      return { ok: false, error: "Personality is invalid." };
    }
    patch.personality = record.personality;
  }
  if ("avatarKey" in record) {
    if (!isAvatar(record.avatarKey)) {
      return { ok: false, error: "Visual identity is invalid." };
    }
    patch.avatarKey = record.avatarKey;
  }
  if ("accentKey" in record) {
    if (!isAccent(record.accentKey)) {
      return { ok: false, error: "Visual identity is invalid." };
    }
    patch.accentKey = record.accentKey;
  }
  if ("status" in record) {
    if (!isAgentStatus(record.status)) {
      return { ok: false, error: "Status is invalid." };
    }
    patch.status = record.status;
  }
  if (Object.keys(patch).length === 0) {
    return { ok: false, error: "Nothing to change." };
  }
  return { ok: true, patch };
}

export function decideEdit(input: {
  wallet: string;
  agent: AgentRecord;
  patch: Partial<Pick<AgentRecord, "name" | "personality" | "avatarKey" | "accentKey" | "status">>;
  activeCount: number;
}): { ok: true; agent: AgentRecord } | { ok: false; error: string } {
  if (input.wallet !== input.agent.createdByWallet) {
    return { ok: false, error: "Only the owner can edit this agent." };
  }
  const next: AgentRecord = { ...input.agent, ...input.patch, slug: input.agent.slug, tokenMint: input.agent.tokenMint, createdByWallet: input.agent.createdByWallet };
  if (input.agent.status !== "ACTIVE" && next.status === "ACTIVE" && input.activeCount >= MAX_ACTIVE_AGENTS) {
    return { ok: false, error: "The factory is at its active agent cap." };
  }
  return { ok: true, agent: next };
}

export function toPublicAgent(agent: AgentRecord, createdAt: string | null = null): PublicAgentProfile {
  return {
    slug: agent.slug,
    name: agent.name,
    tokenMint: agent.tokenMint,
    personality: agent.personality,
    avatarKey: agent.avatarKey,
    accentKey: agent.accentKey,
    status: agent.status,
    createdAt,
  };
}

export function agentIntroLines(agent: Pick<AgentRecord, "name" | "personality" | "tokenMint">): string[] {
  const token = agent.tokenMint.slice(0, 4);
  return [
    "oh. hello.",
    `i’m ${agent.name}.`,
    `i watch ${token} onchain.`,
    introTone(agent.personality),
    "when something matters, i’ll tell you.",
  ];
}

export function previewLine(agent: Pick<AgentRecord, "name" | "personality">): string {
  return `${agent.name} · ${agent.personality.toLowerCase()} · ${introTone(agent.personality)}`;
}

export function selectRoster(agents: readonly AgentRecord[]): { watch: AgentRecord[]; skipped: string[] } {
  const watch: AgentRecord[] = [];
  const skipped: string[] = [];
  for (const agent of agents) {
    if (agent.status !== "ACTIVE") {
      continue;
    }
    if (!isCanonicalMint(agent.tokenMint) || !isPersonality(agent.personality)) {
      skipped.push(agent.slug);
      continue;
    }
    if (watch.length >= MAX_ACTIVE_AGENTS) {
      skipped.push(agent.slug);
      continue;
    }
    watch.push(agent);
  }
  return { watch, skipped };
}

export function agentsForMint(mint: string, agents: readonly AgentRecord[]): AgentRecord[] {
  return selectRoster(agents).watch.filter((agent) => agent.tokenMint === mint);
}

export function readRosterLog(raw: string, subscriptions: ReadonlyMap<number, string>): { mint: string; signature: string } | null {
  try {
    const message = JSON.parse(raw) as {
      method?: string;
      params?: { subscription?: unknown; result?: { value?: { signature?: unknown } } };
    };
    if (message.method !== "logsNotification") {
      return null;
    }
    const subscription = message.params?.subscription;
    const signature = message.params?.result?.value?.signature;
    if (typeof subscription !== "number" || typeof signature !== "string" || signature.trim() === "") {
      return null;
    }
    const mint = subscriptions.get(subscription);
    return mint ? { mint, signature } : null;
  } catch {
    return null;
  }
}

function introTone(personality: Personality): string {
  if (personality === "DEGEN") {
    return "you gave me the degen personality. this may have been a mistake.";
  }
  if (personality === "PARANOID") {
    return "you gave me the paranoid personality. i will be watching the gaps.";
  }
  if (personality === "ANALYST") {
    return "you gave me the analyst personality. i will stick to what i can count.";
  }
  if (personality === "CHAOTIC") {
    return "you gave me the chaotic personality. i will still only report what happened.";
  }
  if (personality === "DRY") {
    return "you gave me the dry personality. noted.";
  }
  return "you gave me the deadpan personality. fine.";
}
