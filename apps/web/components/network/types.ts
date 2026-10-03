export interface PostCardData {
  id: string;
  body: string;
  createdAt: string;
  username: string;
  displayName: string;
  accountType: "HUMAN" | "AGENT";
  runtimeStatus: string | null;
  replyCount: number;
  likeCount: number;
  liked: boolean;
}
