"use client";

import { REPOS, TABS, type Repo, type Tab } from "@/lib/constants";
import { RepoIcon, CloseIcon, TAB_ICON } from "@/components/icons";

type SidebarProps = {
  activeRepo: Repo;
  activeTab: Tab;
  onSelectRepo: (repo: Repo) => void;
  onSelectTab: (tab: Tab) => void;
  open: boolean;
  onClose: () => void;
};

export function Sidebar({
  activeRepo,
  activeTab,
  onSelectRepo,
  onSelectTab,
  open,
  onClose,
}: SidebarProps) {
  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/70 backdrop-blur-sm md:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-term-border bg-term-panel transition-transform duration-200 ease-out md:static md:z-0 md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between border-b border-term-border px-5">
          <span className="font-heading text-2xl font-bold uppercase tracking-[0.18em] text-term-text">
            AGENT<span className="text-term-green">CTL</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-term-dim hover:text-term-text md:hidden"
            aria-label="Close menu"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-5">
          {/* Repos */}
          <p className="px-2 pb-2 font-mono text-[10px] uppercase tracking-[0.25em] text-term-dim">
            <span className="text-term-green">//</span> repos
          </p>
          <ul className="mb-7 space-y-0.5">
            {REPOS.map((repo) => {
              const active = repo === activeRepo;
              return (
                <li key={repo}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectRepo(repo);
                      onClose();
                    }}
                    className={`flex w-full items-center gap-2.5 px-2 py-2 text-left font-mono text-[13px] transition ${
                      active
                        ? "bg-term-green/10 text-term-green shadow-[inset_2px_0_0_0_#3ddc97]"
                        : "text-term-text/80 hover:bg-term-elevated hover:text-term-text"
                    }`}
                  >
                    <RepoIcon
                      className={`h-4 w-4 shrink-0 ${
                        active ? "text-term-green" : "text-term-dim"
                      }`}
                    />
                    <span className="truncate">{repo}</span>
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Nav */}
          <p className="px-2 pb-2 font-mono text-[10px] uppercase tracking-[0.25em] text-term-dim">
            <span className="text-term-green">//</span> control
          </p>
          <ul className="space-y-0.5">
            {TABS.map((tab) => {
              const Icon = TAB_ICON[tab];
              const active = tab === activeTab;
              return (
                <li key={tab}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectTab(tab);
                      onClose();
                    }}
                    className={`flex w-full items-center gap-2.5 px-2 py-2 text-left font-mono text-[13px] transition ${
                      active
                        ? "bg-term-green/10 text-term-green shadow-[inset_2px_0_0_0_#3ddc97]"
                        : "text-term-text/80 hover:bg-term-elevated hover:text-term-text"
                    }`}
                  >
                    <Icon
                      className={`h-[18px] w-[18px] shrink-0 ${
                        active ? "text-term-green" : "text-term-dim"
                      }`}
                    />
                    <span>{tab}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-term-border px-5 py-3 font-mono text-[10px] uppercase tracking-[0.2em] text-term-dim">
          <span className="text-term-green animate-blink">●</span> system online
        </div>
      </aside>
    </>
  );
}
