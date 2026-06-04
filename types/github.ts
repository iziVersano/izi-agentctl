/** A single GitHub-applied label, normalized for the client. */
export type GitHubLabel = {
  name: string;
  /** Hex color WITHOUT the leading "#", as GitHub returns it. */
  color: string;
};

/** Normalized issue/PR shape returned by the /api/github route handlers. */
export type GitHubItem = {
  id: number;
  number: number;
  title: string;
  author: string;
  /** ISO timestamp of creation. */
  createdAt: string;
  /** Open / closed / draft / merged — drives the status badge. */
  state: "open" | "closed" | "draft" | "merged";
  htmlUrl: string;
  labels: GitHubLabel[];
};
