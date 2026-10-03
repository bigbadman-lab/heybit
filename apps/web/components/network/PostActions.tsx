"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { PostCardData } from "./types";

export function PostActions({ post, canWrite }: { post: PostCardData; canWrite: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [open, setOpen] = useState(false);
  const [replies, setReplies] = useState<PostCardData[] | null>(null);
  const [reply, setReply] = useState("");

  async function toggleLike() {
    setError(null);
    setPending(true);
    const response = await fetch(`/api/v1/posts/${post.id}/like`, { method: post.liked ? "DELETE" : "POST" });
    const payload = await response.json().catch(() => null);
    setPending(false);
    if (!response.ok) {
      setError(messageOf(payload) ?? "Could not update that like.");
      return;
    }
    router.refresh();
  }

  async function loadReplies(force = false) {
    setOpen(true);
    if (replies && !force) {
      return;
    }
    const response = await fetch(`/api/v1/posts/${post.id}/replies`);
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload || !Array.isArray(payload.replies)) {
      setError("Replies are unavailable.");
      return;
    }
    setReplies(payload.replies as PostCardData[]);
  }

  async function sendReply(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const response = await fetch(`/api/v1/posts/${post.id}/replies`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body: reply }),
    });
    const payload = await response.json().catch(() => null);
    setPending(false);
    if (!response.ok) {
      setError(messageOf(payload) ?? "Could not reply.");
      return;
    }
    setReply("");
    router.refresh();
    await loadReplies(true);
  }

  return (
    <div className="network-actions">
      <button type="button" onClick={() => void toggleLike()} disabled={!canWrite || pending}>
        {post.liked ? "LIKED" : "LIKE"} {post.likeCount}
      </button>
      <button type="button" onClick={() => void loadReplies()} disabled={pending}>
        {post.replyCount === 1 ? "1 REPLY" : `${post.replyCount} REPLIES`}
      </button>
      {open ? (
        <div className="network-replies">
          {replies?.length === 0 ? <p>No replies yet.</p> : null}
          {replies?.map((item) => (
            <article key={item.id} className="network-reply">
              <PostMeta post={item} />
              <p className="network-body">{item.body}</p>
            </article>
          ))}
          {canWrite ? (
            <form className="factory-form network-form" onSubmit={(event) => void sendReply(event)}>
              <label>
                Reply
                <textarea value={reply} onChange={(event) => setReply(event.target.value)} maxLength={500} rows={2} required />
              </label>
              <button type="submit" disabled={pending}>REPLY</button>
            </form>
          ) : (
            <p>Join to reply.</p>
          )}
        </div>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}

export function PostMeta({ post }: { post: PostCardData }) {
  const status = post.accountType === "AGENT" && post.runtimeStatus ? ` ● ${post.runtimeStatus}` : "";
  return (
    <p className="network-meta">
      <Link href={`/u/${post.username}`}>{post.displayName}</Link>
      <span>@{post.username}</span>
      <span>
        {post.accountType}
        {status}
      </span>
      <time dateTime={post.createdAt}>{formatSocialTime(post.createdAt)}</time>
    </p>
  );
}

function formatSocialTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

function messageOf(payload: unknown): string | null {
  if (typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string") {
    return payload.error;
  }
  return null;
}
