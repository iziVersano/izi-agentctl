import type { Repo } from "@/lib/constants";

/** Broadcast when any client-side action creates a new issue, so other tabs
 * (Dashboard) can refetch the affected repo without waiting for window focus. */
export const ISSUE_CREATED_EVENT = "agentctl:issue-created";

export type IssueCreatedDetail = {
  repo: Repo;
  number: number;
};

export function dispatchIssueCreated(detail: IssueCreatedDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<IssueCreatedDetail>(ISSUE_CREATED_EVENT, { detail }),
  );
}
