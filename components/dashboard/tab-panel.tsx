"use client";

import { TAB_BLURB, type Repo, type Tab } from "@/lib/constants";
import { TAB_ICON } from "@/components/icons";
import { GitHubTab } from "@/components/dashboard/github-tab";

type TabPanelProps = {
  tab: Tab;
  repo: Repo;
};

export function TabPanel({ tab, repo }: TabPanelProps) {
  const Icon = TAB_ICON[tab];

  if (tab === "GitHub") {
    return <GitHubTab repo={repo} />;
  }

  return (
    <section className="flex h-full flex-col p-5 sm:p-8">
      {/* Breadcrumb / command line */}
      <p className="mb-6 font-mono text-xs text-term-dim">
        <span className="text-term-green">agentctl</span>
        <span className="text-term-dim"> ~/{repo} </span>
        <span className="text-term-green">$</span> {tab.toLowerCase()}
      </p>

      {/* Centered placeholder */}
      <div className="flex flex-1 items-center justify-center">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center border border-term-border bg-term-panel text-term-green shadow-glow-sm">
            <Icon className="h-8 w-8" />
          </div>

          <h2 className="font-heading text-3xl font-bold uppercase tracking-[0.15em] text-term-text">
            {tab}
            <span className="ml-1 inline-block h-6 w-[3px] translate-y-0.5 animate-blink bg-term-green align-middle" />
          </h2>

          <p className="mt-3 text-sm text-term-dim">{TAB_BLURB[tab]}</p>

          <p className="mt-6 inline-block border border-term-border bg-term-elevated px-4 py-1.5 font-mono text-xs uppercase tracking-[0.3em] text-term-green/80">
            // coming soon
          </p>
        </div>
      </div>
    </section>
  );
}
