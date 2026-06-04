import { NextResponse } from "next/server";
import {
  assertRepo,
  getGitHubContext,
  ghFetch,
  GitHubError,
} from "@/lib/github";

type CommitInfo = {
  sha: string;
  message: string;
  author: string;
  /** ISO timestamp of the commit (committer.date, falls back to author.date). */
  date: string;
  htmlUrl: string;
};

type CIStatus = {
  /** GitHub's check-runs conclusion summary. null = no runs yet. */
  state: "success" | "failure" | "pending" | "neutral" | "skipped" | "cancelled" | null;
  htmlUrl: string | null;
};

export type RepoMeta = {
  latestCommit: CommitInfo | null;
  openPrCount: number;
  ci: CIStatus;
};

/**
 * Aggregated repo intelligence for the Dashboard grid: latest commit on the
 * default branch, count of open PRs, and the latest CI run's conclusion.
 * Each piece is fetched independently so a single failing endpoint (e.g. no
 * Actions on the repo) doesn't blank the rest.
 */
export async function GET(request: Request) {
  try {
    const repo = assertRepo(new URL(request.url).searchParams.get("repo"));
    const { token, owner } = await getGitHubContext();

    const [commitRes, prRes, runRes, repoRes] = await Promise.allSettled([
      ghFetch(token, `/repos/${owner}/${repo}/commits?per_page=1`),
      ghFetch(token, `/repos/${owner}/${repo}/pulls?state=open&per_page=1`),
      ghFetch(token, `/repos/${owner}/${repo}/actions/runs?per_page=1`),
      ghFetch(token, `/repos/${owner}/${repo}`),
    ]);

    const meta: RepoMeta = {
      latestCommit: await extractCommit(commitRes),
      openPrCount: await extractPrCount(prRes),
      ci: await extractCI(runRes),
    };

    // Touch repoRes so any auth/404 surfaces clearly — the repo metadata isn't
    // returned to the client, but its failure is the most useful signal that
    // something larger is wrong with this repo (renamed, deleted, etc.).
    if (repoRes.status === "fulfilled" && !repoRes.value.ok) {
      const status = repoRes.value.status;
      if (status === 404) {
        return NextResponse.json(
          { error: `Repo ${repo} not found or no access` },
          { status: 404 },
        );
      }
    }

    return NextResponse.json(meta);
  } catch (err) {
    if (err instanceof GitHubError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}

async function extractCommit(
  result: PromiseSettledResult<Response>,
): Promise<CommitInfo | null> {
  if (result.status !== "fulfilled" || !result.value.ok) return null;
  const arr = (await result.value.json()) as Array<{
    sha: string;
    html_url: string;
    commit: {
      message: string;
      author?: { name?: string; date?: string };
      committer?: { date?: string };
    };
    author?: { login?: string };
  }>;
  const c = arr?.[0];
  if (!c) return null;
  return {
    sha: c.sha.slice(0, 7),
    // First line of the commit message keeps the tile readable.
    message: (c.commit.message ?? "").split("\n", 1)[0],
    author: c.author?.login ?? c.commit.author?.name ?? "unknown",
    date: c.commit.committer?.date ?? c.commit.author?.date ?? "",
    htmlUrl: c.html_url,
  };
}

async function extractPrCount(
  result: PromiseSettledResult<Response>,
): Promise<number> {
  if (result.status !== "fulfilled" || !result.value.ok) return 0;
  // The Link header carries the total page count; for a small repo with <30
  // open PRs there's no Link header so we fall back to the body length.
  const link = result.value.headers.get("Link") ?? "";
  const lastMatch = link.match(/[?&]page=(\d+)[^>]*>;\s*rel="last"/);
  if (lastMatch) return Number(lastMatch[1]);
  const arr = (await result.value.json()) as unknown[];
  return Array.isArray(arr) ? arr.length : 0;
}

async function extractCI(
  result: PromiseSettledResult<Response>,
): Promise<CIStatus> {
  if (result.status !== "fulfilled" || !result.value.ok) {
    return { state: null, htmlUrl: null };
  }
  const data = (await result.value.json()) as {
    workflow_runs?: Array<{
      conclusion: string | null;
      status: string;
      html_url: string;
    }>;
  };
  const run = data.workflow_runs?.[0];
  if (!run) return { state: null, htmlUrl: null };

  // status: queued | in_progress | completed
  // conclusion (when completed): success | failure | neutral | cancelled | skipped | timed_out | action_required
  let state: CIStatus["state"] = null;
  if (run.status !== "completed") {
    state = "pending";
  } else {
    const c = run.conclusion;
    if (c === "success") state = "success";
    else if (c === "failure" || c === "timed_out" || c === "action_required")
      state = "failure";
    else if (c === "cancelled") state = "cancelled";
    else if (c === "skipped") state = "skipped";
    else state = "neutral";
  }

  return { state, htmlUrl: run.html_url };
}
