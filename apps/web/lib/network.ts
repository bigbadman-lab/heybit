import "server-only";
import {
  accountTypeForFilter,
  claimUsername,
  isUsernameShape,
  normalizeUsername,
  safeHttpsUrl,
  shownRuntimeStatus,
  validateBio,
  validateDisplayName,
  validatePostBody,
  type AccountType,
  type FeedFilter,
  type AgentRuntimeStatus,
} from "@heybit/shared/social";
import { cookies } from "next/headers";
import { tryCreatePublicServerClient } from "./public-supabase";
import { HUMAN_COOKIE, HUMAN_SESSION_MS, clientActorFields, gateHumanSession } from "./human-wallet";
import {
  findHumanByWallet,
  likedIdsForAccount,
  readOpenHumanSession,
  viewerFollowsAccount,
} from "./human-wallet-store";
import { serverAdminClient } from "./server-admin";

export const FEED_PAGE_SIZE = 20;

export interface Viewer {
  id: string;
  username: string;
  displayName: string;
  accountType: AccountType;
}

export type SessionState =
  | { status: "anonymous" }
  | { status: "unavailable" }
  | { status: "needs-profile" }
  | { status: "ready"; account: Viewer };

export interface SocialPost {
  id: string;
  body: string;
  createdAt: string;
  username: string;
  displayName: string;
  accountType: AccountType;
  runtimeStatus: AgentRuntimeStatus | null;
  replyCount: number;
  likeCount: number;
  liked: boolean;
}

export interface SocialProfile {
  id: string;
  username: string;
  displayName: string;
  accountType: AccountType;
  bio: string | null;
  avatarUrl: string | null;
  runtimeStatus: AgentRuntimeStatus | null;
  ownerUsername: string | null;
  followerCount: number;
  followingCount: number;
  viewerFollows: boolean;
}

export interface FeedPage {
  status: "ready" | "unavailable";
  items: SocialPost[];
  nextCursor: string | null;
}

const POST_COLUMNS =
  "id, body, created_at, username, display_name, account_type, runtime_status, reply_count, like_count";

const RPC_ERRORS: Record<string, { status: number; error: string }> = {
  unauthenticated: { status: 401, error: "Sign in to do that." },
  needs_profile: { status: 409, error: "Choose a username before doing that." },
  reserved_username: { status: 409, error: "That username is reserved." },
  username_taken: { status: 409, error: "That username is taken." },
  invalid_username: { status: 400, error: "Username must be 2–24 URL-safe characters." },
  invalid_display_name: { status: 400, error: "Display name must be 1–32 characters." },
  invalid_bio: { status: 400, error: "Bio must be 160 characters or fewer." },
  empty_post: { status: 400, error: "Write something first." },
  post_too_long: { status: 400, error: "That post is too long." },
  invalid_parent: { status: 400, error: "That reply has no parent post." },
  posting_too_quickly: { status: 429, error: "Wait a moment before posting again." },
  spoof_bit: { status: 403, error: "You cannot post as BIT." },
  self_follow: { status: 400, error: "You cannot follow yourself." },
  missing_account: { status: 404, error: "That account is not on the network." },
  missing_post: { status: 404, error: "That post is not on the network." },
  agent_limit: { status: 400, error: "You can own up to five agents from the web." },
  invalid_wallet: { status: 400, error: "Wallet is invalid." },
};

export async function readJson(request: Request): Promise<unknown> {
  const length = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(length) && length > 8_000) {
    return null;
  }
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export function networkJson(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

export function rpcFailure(error: { message?: string } | null): Response {
  const message = error?.message ?? "";
  for (const [token, mapped] of Object.entries(RPC_ERRORS)) {
    if (message.includes(token)) {
      return networkJson({ error: mapped.error }, mapped.status);
    }
  }
  return networkJson({ error: "The network could not do that." }, 400);
}

export function parseFeedCursor(raw: string | null | undefined): string | null {
  if (!raw || raw.length > 40) {
    return null;
  }
  const time = Date.parse(raw);
  if (!Number.isFinite(time)) {
    return null;
  }
  return new Date(time).toISOString();
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function humanCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge,
  };
}

export async function readHumanCookieToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(HUMAN_COOKIE)?.value ?? null;
}

export async function writeHumanCookie(token: string): Promise<void> {
  const jar = await cookies();
  jar.set(HUMAN_COOKIE, token, humanCookieOptions(HUMAN_SESSION_MS / 1000));
}

export async function clearHumanCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(HUMAN_COOKIE, "", humanCookieOptions(0));
}

export async function readSessionState(): Promise<SessionState> {
  try {
    const token = await readHumanCookieToken();
    if (!token) {
      return { status: "anonymous" };
    }
    if (!serverAdminClient()) {
      return { status: "unavailable" };
    }
    const session = await readOpenHumanSession(token, Date.now());
    if (!session) {
      return { status: "anonymous" };
    }
    const account = await findHumanByWallet(session.wallet);
    if (!account) {
      return { status: "needs-profile" };
    }
    return { status: "ready", account };
  } catch {
    return { status: "unavailable" };
  }
}

export async function readFeed(before: string | null, filter: FeedFilter = "all"): Promise<FeedPage> {
  const client = tryCreatePublicServerClient();
  if (!client) {
    return { status: "unavailable", items: [], nextCursor: null };
  }
  let query = client
    .from("network_posts")
    .select(POST_COLUMNS)
    .is("parent_post_id", null)
    .order("created_at", { ascending: false })
    .limit(FEED_PAGE_SIZE + 1);
  const accountType = accountTypeForFilter(filter);
  if (accountType) {
    query = query.eq("account_type", accountType);
  }
  if (before) {
    query = query.lt("created_at", before);
  }
  const result = await query;
  if (result.error || !Array.isArray(result.data)) {
    return { status: "unavailable", items: [], nextCursor: null };
  }
  return pageFromRows(result.data);
}

export async function readNetworkCounts(): Promise<{ accounts: number; humans: number; agents: number } | null> {
  const client = tryCreatePublicServerClient();
  if (!client) {
    return null;
  }
  const [humans, agents] = await Promise.all([
    client.from("network_profiles").select("id", { count: "exact", head: true }).eq("account_type", "HUMAN"),
    client.from("network_profiles").select("id", { count: "exact", head: true }).eq("account_type", "AGENT"),
  ]);
  if (humans.error || agents.error || humans.count === null || agents.count === null) {
    return null;
  }
  return { humans: humans.count, agents: agents.count, accounts: humans.count + agents.count };
}

export async function readProfile(username: string): Promise<
  | { status: "ready"; profile: SocialProfile }
  | { status: "missing" }
  | { status: "unavailable" }
> {
  const name = normalizeUsername(username);
  if (!isUsernameShape(name)) {
    return { status: "missing" };
  }
  const client = tryCreatePublicServerClient();
  if (!client) {
    return { status: "unavailable" };
  }
  const result = await client.from("network_profiles").select("*").eq("username", name).maybeSingle();
  if (result.error) {
    return { status: "unavailable" };
  }
  if (!result.data) {
    return { status: "missing" };
  }
  const profile = profileFromRow(result.data);
  if (!profile) {
    return { status: "unavailable" };
  }
  const session = await readOpenHumanSession(await readHumanCookieToken(), Date.now());
  if (session) {
    const viewer = await findHumanByWallet(session.wallet);
    if (viewer) {
      profile.viewerFollows = await viewerFollowsAccount(viewer.id, name);
    }
  }
  return { status: "ready", profile };
}

export async function readAccountPosts(username: string, before: string | null): Promise<FeedPage> {
  const name = normalizeUsername(username);
  if (!isUsernameShape(name)) {
    return { status: "ready", items: [], nextCursor: null };
  }
  const client = tryCreatePublicServerClient();
  if (!client) {
    return { status: "unavailable", items: [], nextCursor: null };
  }
  let query = client
    .from("network_posts")
    .select(POST_COLUMNS)
    .eq("username", name)
    .is("parent_post_id", null)
    .order("created_at", { ascending: false })
    .limit(FEED_PAGE_SIZE + 1);
  if (before) {
    query = query.lt("created_at", before);
  }
  const result = await query;
  if (result.error || !Array.isArray(result.data)) {
    return { status: "unavailable", items: [], nextCursor: null };
  }
  return pageFromRows(result.data);
}

export async function readReplies(postId: string): Promise<{ status: "ready"; items: SocialPost[] } | { status: "unavailable" }> {
  if (!isUuid(postId)) {
    return { status: "ready", items: [] };
  }
  const client = tryCreatePublicServerClient();
  if (!client) {
    return { status: "unavailable" };
  }
  const result = await client
    .from("network_posts")
    .select(POST_COLUMNS)
    .eq("parent_post_id", postId)
    .order("created_at", { ascending: true })
    .limit(FEED_PAGE_SIZE);
  if (result.error || !Array.isArray(result.data)) {
    return { status: "unavailable" };
  }
  const items = await withLikes(result.data.map(postFromRow).filter((item): item is SocialPost => item !== null));
  return { status: "ready", items };
}

export async function requireHumanActor(
  body: unknown,
  mode: "session" | "writer",
): Promise<{ wallet: string; accountId: string | null } | { response: Response }> {
  if (!serverAdminClient()) {
    return { response: networkJson({ error: "The network is unavailable." }, 503) };
  }
  const session = await readOpenHumanSession(await readHumanCookieToken(), Date.now());
  const account = session ? await findHumanByWallet(session.wallet) : null;
  const fields = clientActorFields(body);
  const gate = gateHumanSession({
    sessionWallet: session?.wallet ?? null,
    account: account
      ? { id: account.id, username: account.username, accountType: account.accountType }
      : null,
    clientAccountId: fields.clientAccountId,
    clientWallet: fields.clientWallet,
    clientOwnerId: fields.clientOwnerId,
  });
  if (!gate.ok) {
    const status = gate.reason === "spoof" ? 403 : 401;
    const error = gate.reason === "spoof" ? "That action is not allowed." : "Sign in to do that.";
    return { response: networkJson({ error }, status) };
  }
  if (mode === "writer" && !gate.accountId) {
    return { response: networkJson({ error: "Choose a username before doing that." }, 409) };
  }
  return { wallet: gate.wallet, accountId: gate.accountId };
}

export function profileInput(
  body: unknown,
  accountType: AccountType,
): { ok: true; username: string; displayName: string; bio: string } | { ok: false; response: Response } {
  const record = asRecord(body);
  if (!record) {
    return { ok: false, response: networkJson({ error: "Invalid request." }, 400) };
  }
  const username = typeof record.username === "string" ? record.username : "";
  const displayName = typeof record.displayName === "string" ? record.displayName : "";
  const bio = typeof record.bio === "string" ? record.bio : "";
  const claimed = claimUsername(new Set(), username, { accountType });
  if (!claimed.ok) {
    const error = claimed.error === "reserved" ? "That username is reserved." : "Username must be 2–24 URL-safe characters.";
    return { ok: false, response: networkJson({ error }, 400) };
  }
  const name = validateDisplayName(displayName);
  if (!name.ok) {
    return { ok: false, response: networkJson({ error: name.error }, 400) };
  }
  const about = validateBio(bio);
  if (!about.ok) {
    return { ok: false, response: networkJson({ error: about.error }, 400) };
  }
  return { ok: true, username: claimed.username, displayName: name.displayName, bio: about.bio ?? "" };
}

export function postInput(body: unknown): { ok: true; body: string } | { ok: false; response: Response } {
  const record = asRecord(body);
  const raw = record && typeof record.body === "string" ? record.body : "";
  const parsed = validatePostBody(raw);
  if (!parsed.ok) {
    return { ok: false, response: networkJson({ error: parsed.error }, 400) };
  }
  return { ok: true, body: parsed.body };
}

async function pageFromRows(rows: unknown[]): Promise<FeedPage> {
  const parsed = rows.map(postFromRow).filter((item): item is SocialPost => item !== null);
  const hasMore = parsed.length > FEED_PAGE_SIZE;
  const items = await withLikes(parsed.slice(0, FEED_PAGE_SIZE));
  const last = items[items.length - 1];
  return {
    status: "ready",
    items,
    nextCursor: hasMore && last ? last.createdAt : null,
  };
}

async function withLikes(items: SocialPost[]): Promise<SocialPost[]> {
  if (items.length === 0) {
    return items;
  }
  try {
    const session = await readOpenHumanSession(await readHumanCookieToken(), Date.now());
    if (!session) {
      return items;
    }
    const account = await findHumanByWallet(session.wallet);
    if (!account) {
      return items;
    }
    const ids = await likedIdsForAccount(account.id, items.map((item) => item.id));
    if (!ids) {
      return items;
    }
    return items.map((item) => ({ ...item, liked: ids.has(item.id) }));
  } catch {
    return items;
  }
}

function postFromRow(value: unknown): SocialPost | null {
  const record = asRecord(value);
  if (!record || typeof record.id !== "string" || typeof record.body !== "string") {
    return null;
  }
  const accountType = record.account_type === "AGENT" ? "AGENT" : record.account_type === "HUMAN" ? "HUMAN" : null;
  if (!accountType || typeof record.username !== "string" || typeof record.display_name !== "string") {
    return null;
  }
  const createdAt = typeof record.created_at === "string" ? record.created_at : "";
  return {
    id: record.id,
    body: record.body,
    createdAt,
    username: record.username,
    displayName: record.display_name,
    accountType,
    runtimeStatus: shownRuntimeStatus(typeof record.runtime_status === "string" ? record.runtime_status : null),
    replyCount: asCount(record.reply_count),
    likeCount: asCount(record.like_count),
    liked: false,
  };
}

function profileFromRow(value: unknown): SocialProfile | null {
  const record = asRecord(value);
  if (!record || typeof record.id !== "string" || typeof record.username !== "string") {
    return null;
  }
  const accountType = record.account_type === "AGENT" ? "AGENT" : record.account_type === "HUMAN" ? "HUMAN" : null;
  if (!accountType || typeof record.display_name !== "string") {
    return null;
  }
  return {
    id: record.id,
    username: record.username,
    displayName: record.display_name,
    accountType,
    bio: typeof record.bio === "string" ? record.bio : null,
    avatarUrl: safeHttpsUrl(typeof record.avatar_url === "string" ? record.avatar_url : null),
    runtimeStatus: shownRuntimeStatus(typeof record.runtime_status === "string" ? record.runtime_status : null),
    ownerUsername: typeof record.owner_username === "string" ? record.owner_username : null,
    followerCount: asCount(record.follower_count),
    followingCount: asCount(record.following_count),
    viewerFollows: false,
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asCount(value: unknown): number {
  const count = typeof value === "number" ? value : typeof value === "string" ? Number(value) : 0;
  return Number.isFinite(count) ? count : 0;
}
