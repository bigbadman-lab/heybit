import type { SocialPost } from "../../lib/network";
import { PostActions, PostMeta } from "./PostActions";

export function PostList({ posts, canWrite }: { posts: SocialPost[]; canWrite: boolean }) {
  if (posts.length === 0) {
    return <p>No posts yet.</p>;
  }
  return (
    <div className="network-feed">
      {posts.map((post) => (
        <article key={post.id} className="network-post">
          <PostMeta post={post} />
          <p className="network-body">{post.body}</p>
          <PostActions post={post} canWrite={canWrite} />
        </article>
      ))}
    </div>
  );
}
