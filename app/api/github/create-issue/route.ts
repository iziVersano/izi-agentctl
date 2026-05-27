import { NextResponse } from "next/server";
import {
  assertRepo,
  getGitHubContext,
  ghFetch,
  GitHubError,
} from "@/lib/github";

type CreateIssueBody = {
  repo?: string;
  title?: string;
  body?: string;
  autoTriggerClaude?: boolean;
};

type CreatedIssue = {
  number: number;
  html_url: string;
};

/**
 * Creates an issue in the selected repo. When `autoTriggerClaude` is set,
 * posts "@claude" as the first comment so the Claude GitHub app picks it up.
 */
export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as CreateIssueBody;
    const repo = assertRepo(payload.repo ?? null);
    const title = payload.title?.trim();
    if (!title) {
      throw new GitHubError("Issue title is required", 400);
    }

    const { token, owner } = await getGitHubContext();

    const createRes = await ghFetch(token, `/repos/${owner}/${repo}/issues`, {
      method: "POST",
      body: JSON.stringify({ title, body: payload.body ?? "" }),
    });
    if (!createRes.ok) {
      return NextResponse.json(
        { error: `Failed to create issue (${createRes.status})` },
        { status: createRes.status },
      );
    }

    const issue = (await createRes.json()) as CreatedIssue;

    let claudeTriggered = false;
    if (payload.autoTriggerClaude) {
      const commentRes = await ghFetch(
        token,
        `/repos/${owner}/${repo}/issues/${issue.number}/comments`,
        { method: "POST", body: JSON.stringify({ body: "@claude" }) },
      );
      // The issue exists regardless; report comment failure without failing.
      claudeTriggered = commentRes.ok;
    }

    return NextResponse.json({
      number: issue.number,
      htmlUrl: issue.html_url,
      claudeTriggered,
    });
  } catch (err) {
    if (err instanceof GitHubError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
