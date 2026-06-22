export const REPOS = [
  "gaming-hub-home",
  "spark-toys-hebrew-redo",
  "gaestehaus-kraus",
  "sol-hebrew-gems",
  "TerraWiz",
  "aventura-ride-hub",
  "partscloud",
] as const;

export type Repo = (typeof REPOS)[number];

export const REPO_TAGS: Partial<Record<Repo, string[]>> = {
  partscloud: ["tech task"],
};

export const TABS = [
  "Dashboard",
  "Inbox",
  "Agent",
  "GitHub",
  "Terraform",
  "Deploys",
  "Report",
] as const;

export type Tab = (typeof TABS)[number];

/** Short status line shown under each placeholder tab title. */
export const TAB_BLURB: Record<Tab, string> = {
  Dashboard: "Snapshot of every repo with live open-issue counts.",
  Inbox: "Triage forwarded Telegram messages into GitHub issues.",
  Agent: "Issue commands to the autonomous agent and watch it work.",
  GitHub: "Browse branches, pull requests, and commit history.",
  Terraform: "Plan and apply infrastructure changes.",
  Deploys: "Track deployments and roll back when needed.",
  Report: "Aggregate health, activity, and cost reporting.",
};
