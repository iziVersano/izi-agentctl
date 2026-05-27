"use client";

import { useState } from "react";
import { REPOS, TABS, type Repo, type Tab } from "@/lib/constants";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Topbar } from "@/components/dashboard/topbar";
import { BottomNav } from "@/components/dashboard/bottom-nav";
import { TabPanel } from "@/components/dashboard/tab-panel";

type DashboardProps = {
  user: { name: string | null; image: string | null; email: string | null };
};

export function Dashboard({ user }: DashboardProps) {
  const [activeRepo, setActiveRepo] = useState<Repo>(REPOS[0]);
  const [activeTab, setActiveTab] = useState<Tab>(TABS[0]);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar
        activeRepo={activeRepo}
        activeTab={activeTab}
        onSelectRepo={setActiveRepo}
        onSelectTab={setActiveTab}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          activeRepo={activeRepo}
          user={user}
          onOpenMenu={() => setMenuOpen(true)}
        />

        {/* Desktop tab bar */}
        <div className="hidden shrink-0 items-center gap-1 border-b border-term-border bg-term-panel/40 px-4 md:flex">
          {TABS.map((tab) => {
            const active = tab === activeTab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`relative px-4 py-3 font-mono text-[13px] uppercase tracking-wide transition ${
                  active
                    ? "text-term-green"
                    : "text-term-dim hover:text-term-text"
                }`}
              >
                {tab}
                {active && (
                  <span className="absolute inset-x-3 -bottom-px h-0.5 bg-term-green shadow-glow-sm" />
                )}
              </button>
            );
          })}
        </div>

        <main className="flex-1 overflow-y-auto">
          <TabPanel tab={activeTab} repo={activeRepo} />
        </main>

        <BottomNav activeTab={activeTab} onSelectTab={setActiveTab} />
      </div>
    </div>
  );
}
