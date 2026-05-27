import { NextResponse } from "next/server";
import {
  assertRepo,
  getGitHubContext,
  ghFetch,
  GitHubError,
} from "@/lib/github";
import type { GitHubItem } from "@/types/github";

type GitHubIssue = {
  id: number;
  number: number;
  title: string;
  state: "open" | "closed";
  created_at: string;
  html_url: string;
  user: { login: string } | null;
  pull_request?: unknown;
};

/** Open issues for the selected repo (PRs are filtered out — GitHub's issues
 * endpoint includes PRs, which we surface separately). */
export async function GET(request: Request) {
  try {
    const repo = assertRepo(new URL(request.url).searchParams.get("repo"));
    const { token, owner } = await getGitHubContext();

    const res = await ghFetch(
      token,
      `/repos/${owner}/${repo}/issues?state=open&per_page=30`,
    );
    if (!res.ok) {
      return NextResponse.json(
        { error: `GitHub returned ${res.status}` },
        { status: res.status },
      );
    }

    const issues = (await res.json()) as GitHubIssue[];
    const items: GitHubItem[] = issues
      .filter((i) => !i.pull_request)
      .map((i) => ({
        id: i.id,
        number: i.number,
        title: i.title,
        author: i.user?.login ?? "unknown",
        createdAt: i.created_at,
        state: i.state,
        htmlUrl: i.html_url,
      }));

    return NextResponse.json({ items });
  } catch (err) {
    return errorResponse(err);
  }
}

function errorResponse(err: unknown) {
  if (err instanceof GitHubError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
}
