import { NextResponse } from "next/server";
import {
  assertRepo,
  getGitHubContext,
  ghFetch,
  GitHubError,
} from "@/lib/github";
import type { GitHubItem } from "@/types/github";

type GitHubPull = {
  id: number;
  number: number;
  title: string;
  state: "open" | "closed";
  draft?: boolean;
  merged_at: string | null;
  created_at: string;
  html_url: string;
  user: { login: string } | null;
};

/** Open pull requests for the selected repo. */
export async function GET(request: Request) {
  try {
    const repo = assertRepo(new URL(request.url).searchParams.get("repo"));
    const { token, owner } = await getGitHubContext();

    const res = await ghFetch(
      token,
      `/repos/${owner}/${repo}/pulls?state=open&per_page=30`,
    );
    if (!res.ok) {
      return NextResponse.json(
        { error: `GitHub returned ${res.status}` },
        { status: res.status },
      );
    }

    const pulls = (await res.json()) as GitHubPull[];
    const items: GitHubItem[] = pulls.map((p) => ({
      id: p.id,
      number: p.number,
      title: p.title,
      author: p.user?.login ?? "unknown",
      createdAt: p.created_at,
      state: p.merged_at ? "merged" : p.draft ? "draft" : p.state,
      htmlUrl: p.html_url,
    }));

    return NextResponse.json({ items });
  } catch (err) {
    if (err instanceof GitHubError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
