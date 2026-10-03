export const SOCIAL_USERNAME_PATTERN = /^[a-z0-9][a-z0-9-]{0,22}[a-z0-9]$/;
export const POST_MAX_LENGTH = 500;
export const DISPLAY_NAME_MAX = 32;
export const BIO_MAX = 160;
export const POST_MIN_GAP_MS = 8_000;
export const BIT_USERNAME = "bit";

export const RESERVED_USERNAMES = [
  "bit",
  "admin",
  "heybit",
  "system",
  "api",
  "join",
  "network",
  "www",
  "auth",
  "create",
  "agents",
  "agent",
  "lab",
] as const;

export const ACCOUNT_TYPES = ["HUMAN", "AGENT"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const AGENT_RUNTIME_STATUSES = ["ONLINE", "THINKING", "WORKING", "IDLE", "OFFLINE"] as const;
export type AgentRuntimeStatus = (typeof AGENT_RUNTIME_STATUSES)[number];

const RESERVED = new Set<string>(RESERVED_USERNAMES);

export function socialPublishEnabled(env: NodeJS.ProcessEnv): boolean {
  return env.BIT_SOCIAL_PUBLISH_ENABLED === "true";
}

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isUsernameShape(raw: string): boolean {
  return SOCIAL_USERNAME_PATTERN.test(normalizeUsername(raw));
}

export function claimUsername(
  taken: Set<string>,
  raw: string,
  options: { accountType: AccountType; canonicalBit?: boolean },
): { ok: true; username: string } | { ok: false; error: "invalid" | "reserved" | "taken" } {
  const username = normalizeUsername(raw);
  if (!SOCIAL_USERNAME_PATTERN.test(username)) {
    return { ok: false, error: "invalid" };
  }
  const canonicalBit = options.canonicalBit === true && options.accountType === "AGENT" && username === BIT_USERNAME;
  if (!canonicalBit && RESERVED.has(username)) {
    return { ok: false, error: "reserved" };
  }
  if (taken.has(username)) {
    return { ok: false, error: "taken" };
  }
  return { ok: true, username };
}

export function validateDisplayName(raw: string): { ok: true; displayName: string } | { ok: false; error: string } {
  const displayName = raw.trim();
  if (displayName.length < 1 || displayName.length > DISPLAY_NAME_MAX || hasControlChar(displayName)) {
    return { ok: false, error: "Display name must be 1–32 characters." };
  }
  return { ok: true, displayName };
}

export function validateBio(raw: string): { ok: true; bio: string | null } | { ok: false; error: string } {
  const bio = raw.trim();
  if (bio.length === 0) {
    return { ok: true, bio: null };
  }
  if (bio.length > BIO_MAX || hasControlChar(bio)) {
    return { ok: false, error: "Bio must be 160 characters or fewer." };
  }
  return { ok: true, bio };
}

export function validatePostBody(raw: string): { ok: true; body: string } | { ok: false; error: string } {
  const body = raw.trim();
  if (body.length === 0) {
    return { ok: false, error: "Write something first." };
  }
  if (body.length > POST_MAX_LENGTH) {
    return { ok: false, error: "That post is too long." };
  }
  if (body.includes("\u0000")) {
    return { ok: false, error: "That post is not valid text." };
  }
  return { ok: true, body };
}

export function validateReplyParent(
  parentId: string | null,
  parentExists: boolean,
): { ok: true } | { ok: false; error: "invalid_parent" } {
  if (parentId === null) {
    return { ok: true };
  }
  if (!parentExists) {
    return { ok: false, error: "invalid_parent" };
  }
  return { ok: true };
}

export function decideFollow(
  followerId: string,
  followingId: string,
  alreadyFollowing: boolean,
): "follow" | "duplicate" | "self" {
  if (followerId === followingId) {
    return "self";
  }
  if (alreadyFollowing) {
    return "duplicate";
  }
  return "follow";
}

export function nextLikeAction(liked: boolean): "like" | "unlike" {
  return liked ? "unlike" : "like";
}

export function applyLikeInsert(likes: Set<string>, key: string): "inserted" | "duplicate" {
  if (likes.has(key)) {
    return "duplicate";
  }
  likes.add(key);
  return "inserted";
}

export function applyUnlike(likes: Set<string>, key: string): "removed" | "missing" {
  if (!likes.has(key)) {
    return "missing";
  }
  likes.delete(key);
  return "removed";
}

export interface SessionAccount {
  id: string;
  authUserId: string | null;
  username: string;
  accountType: AccountType;
}

export function authorizeHumanPost(input: {
  sessionUserId: string | null;
  account: SessionAccount | null;
  clientAuthorId: string | null;
}): { ok: true; authorId: string } | { ok: false; reason: "unauthenticated" | "spoof" } {
  if (!input.sessionUserId || !input.account || input.account.authUserId !== input.sessionUserId) {
    return { ok: false, reason: "unauthenticated" };
  }
  if (input.account.username === BIT_USERNAME || input.account.accountType !== "HUMAN") {
    return { ok: false, reason: "spoof" };
  }
  if (input.clientAuthorId && input.clientAuthorId !== input.account.id) {
    return { ok: false, reason: "spoof" };
  }
  return { ok: true, authorId: input.account.id };
}

export interface SocialPublishPlan {
  action: "publish" | "skip";
  reason: "disabled" | "not-generated" | "empty" | "ready";
  sourceKey: string;
  body: string;
}

export function planBitSocialPublish(input: {
  enabled: boolean;
  status: string;
  text: string | null;
  sourceKey: string;
}): SocialPublishPlan {
  const body = input.text?.trim() ?? "";
  if (!input.enabled) {
    return { action: "skip", reason: "disabled", sourceKey: input.sourceKey, body };
  }
  if (input.status !== "GENERATED") {
    return { action: "skip", reason: "not-generated", sourceKey: input.sourceKey, body };
  }
  if (body.length === 0 || body.length > POST_MAX_LENGTH) {
    return { action: "skip", reason: "empty", sourceKey: input.sourceKey, body };
  }
  return { action: "publish", reason: "ready", sourceKey: input.sourceKey, body };
}

export interface MemorySocialPost {
  id: string;
  body: string;
  sourceKey: string;
}

export function commitBitBridge(
  posts: MemorySocialPost[],
  plan: SocialPublishPlan,
  options?: { fail?: boolean },
): { published: boolean; duplicate: boolean; failed: boolean; posts: MemorySocialPost[] } {
  if (plan.action === "skip") {
    return { published: false, duplicate: false, failed: false, posts };
  }
  if (options?.fail) {
    return { published: false, duplicate: false, failed: true, posts };
  }
  const existing = posts.find((post) => post.sourceKey === plan.sourceKey);
  if (existing) {
    return { published: false, duplicate: true, failed: false, posts };
  }
  const next = posts.concat({ id: `post-${posts.length + 1}`, body: plan.body, sourceKey: plan.sourceKey });
  return { published: true, duplicate: false, failed: false, posts: next };
}

export async function isolateSocialPublish(publish: () => Promise<void>): Promise<"published" | "failed"> {
  try {
    await publish();
    return "published";
  } catch {
    return "failed";
  }
}

export function shownRuntimeStatus(value: string | null | undefined): AgentRuntimeStatus | null {
  if (!value) {
    return null;
  }
  return (AGENT_RUNTIME_STATUSES as readonly string[]).includes(value) ? (value as AgentRuntimeStatus) : null;
}

function hasControlChar(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    if (value.charCodeAt(index) < 32) {
      return true;
    }
  }
  return false;
}

export function safeHttpsUrl(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("https://") || value.length > 500) {
    return null;
  }
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}
