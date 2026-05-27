export const REPOS = [
  "gaming-hub-home",
  "spark-toys-hebrew-redo",
  "gaestehaus-kraus",
  "sol-hebrew-gems",
  "TerraWiz",
] as const;

export type Repo = (typeof REPOS)[number];

export const TABS = [
  "Agent",
  "GitHub",
  "Terraform",
  "Deploys",
  "Report",
] as const;

export type Tab = (typeof TABS)[number];

/** Short status line shown under each placeholder tab title. */
export const TAB_BLURB: Record<Tab, string> = {
  Agent: "Issue commands to the autonomous agent and watch it work.",
  GitHub: "Browse branches, pull requests, and commit history.",
  Terraform: "Plan and apply infrastructure changes.",
  Deploys: "Track deployments and roll back when needed.",
  Report: "Aggregate health, activity, and cost reporting.",
};
