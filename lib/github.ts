import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { REPOS, type Repo } from "@/lib/constants";

const GITHUB_API = "https://api.github.com";

export type GitHubContext = {
  token: string;
  /** Login of the authenticated user; used as the repo owner. */
  owner: string;
};

/**
 * Resolves the GitHub access token (from the NextAuth session) and the repo
 * owner (the authenticated user's login). Throws a tagged Error whose message
 * is safe to surface; the token itself never leaves the server.
 */
export async function getGitHubContext(): Promise<GitHubContext> {
  const session = await getServerSession(authOptions);
  const token = session?.accessToken;
  if (!token) {
    throw new GitHubError("Not authenticated", 401);
  }

  const res = await fetch(`${GITHUB_API}/user`, {
    headers: ghHeaders(token),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new GitHubError("Failed to resolve GitHub user", res.status);
  }
  const user = (await res.json()) as { login?: string };
  if (!user.login) {
    throw new GitHubError("GitHub user has no login", 502);
  }

  return { token, owner: user.login };
}

/** Validates that `repo` is one of the known repos, else throws 400. */
export function assertRepo(repo: string | null): Repo {
  if (repo && (REPOS as readonly string[]).includes(repo)) {
    return repo as Repo;
  }
  throw new GitHubError("Unknown or missing repo", 400);
}

export function ghHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

export async function ghFetch(
  token: string,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  return fetch(`${GITHUB_API}${path}`, {
    ...init,
    headers: { ...ghHeaders(token), ...init?.headers },
    cache: "no-store",
  });
}

export class GitHubError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "GitHubError";
  }
}
