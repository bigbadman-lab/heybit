import {
  BIT_USERNAME,
  POST_MIN_GAP_MS,
  claimUsername,
  decideFollow,
  nextLikeAction,
  validatePostBody,
  validateReplyParent,
} from "@heybit/shared/social";
import type { HumanActorAccount } from "./human-wallet";

export interface BoundHuman {
  accountId: string;
  username: string;
  displayName: string;
  wallet: string;
}

export function planHumanProfile(input: {
  wallet: string;
  existing: BoundHuman | null;
  taken: Set<string>;
  username: string;
  displayName: string;
  bio: string;
}):
  | { ok: true; action: "resolve"; human: BoundHuman }
  | { ok: true; action: "create"; wallet: string; username: string; displayName: string; bio: string }
  | { ok: false; error: "reserved" | "invalid" | "taken" | "display" | "bio" } {
  if (input.existing) {
    return { ok: true, action: "resolve", human: input.existing };
  }
  const claimed = claimUsername(input.taken, input.username, { accountType: "HUMAN" });
  if (!claimed.ok) {
    return { ok: false, error: claimed.error === "taken" ? "taken" : claimed.error === "reserved" ? "reserved" : "invalid" };
  }
  const displayName = input.displayName.trim();
  if (displayName.length < 1 || displayName.length > 32 || displayName.includes("\u0000")) {
    return { ok: false, error: "display" };
  }
  const bio = input.bio.trim();
  if (bio.length > 160 || bio.includes("\u0000")) {
    return { ok: false, error: "bio" };
  }
  return {
    ok: true,
    action: "create",
    wallet: input.wallet,
    username: claimed.username,
    displayName,
    bio,
  };
}

export function planHumanPost(input: {
  account: HumanActorAccount;
  body: string;
  parentId: string | null;
  parentExists: boolean;
  lastPostAtMs: number | null;
  nowMs: number;
}): { ok: true; authorId: string; body: string; parentId: string | null } | { ok: false; error: "spoof" | "empty" | "long" | "parent" | "rate" } {
  if (input.account.accountType !== "HUMAN" || input.account.username === BIT_USERNAME) {
    return { ok: false, error: "spoof" };
  }
  const parsed = validatePostBody(input.body);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error === "That post is too long." ? "long" : "empty" };
  }
  const parent = validateReplyParent(input.parentId, input.parentExists);
  if (!parent.ok) {
    return { ok: false, error: "parent" };
  }
  if (input.lastPostAtMs !== null && input.nowMs - input.lastPostAtMs < POST_MIN_GAP_MS) {
    return { ok: false, error: "rate" };
  }
  return { ok: true, authorId: input.account.id, body: parsed.body, parentId: input.parentId };
}

export function planHumanLike(input: {
  account: HumanActorAccount;
  postExists: boolean;
  liked: boolean;
}): { ok: true; accountId: string; action: "like" | "unlike" } | { ok: false; error: "spoof" | "missing" } {
  if (input.account.accountType !== "HUMAN" || input.account.username === BIT_USERNAME) {
    return { ok: false, error: "spoof" };
  }
  if (!input.postExists) {
    return { ok: false, error: "missing" };
  }
  return { ok: true, accountId: input.account.id, action: nextLikeAction(input.liked) };
}

export function planHumanFollow(input: {
  account: HumanActorAccount;
  targetId: string | null;
  targetUsername: string;
  alreadyFollowing: boolean;
  remove: boolean;
}):
  | { ok: true; followerId: string; followingId: string; action: "follow" | "unfollow" }
  | { ok: false; error: "spoof" | "missing" | "self" } {
  if (input.account.accountType !== "HUMAN" || input.account.username === BIT_USERNAME) {
    return { ok: false, error: "spoof" };
  }
  if (!input.targetId) {
    return { ok: false, error: "missing" };
  }
  if (input.remove) {
    return { ok: true, followerId: input.account.id, followingId: input.targetId, action: "unfollow" };
  }
  const decision = decideFollow(input.account.id, input.targetId, input.alreadyFollowing);
  if (decision === "self") {
    return { ok: false, error: "self" };
  }
  return { ok: true, followerId: input.account.id, followingId: input.targetId, action: "follow" };
}

export function sameWalletHuman(existing: BoundHuman[], wallet: string): BoundHuman | null {
  return existing.find((human) => human.wallet === wallet) ?? null;
}
