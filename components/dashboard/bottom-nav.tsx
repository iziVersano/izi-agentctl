"use client";

import { TABS, type Tab } from "@/lib/constants";
import { TAB_ICON } from "@/components/icons";

type BottomNavProps = {
  activeTab: Tab;
  onSelectTab: (tab: Tab) => void;
};

export function BottomNav({ activeTab, onSelectTab }: BottomNavProps) {
  return (
    <nav className="flex shrink-0 border-t border-term-border bg-term-panel md:hidden">
      {TABS.map((tab) => {
        const Icon = TAB_ICON[tab];
        const active = tab === activeTab;
        return (
          <button
            key={tab}
            type="button"
            onClick={() => onSelectTab(tab)}
            className={`flex flex-1 flex-col items-center gap-1 py-2.5 font-mono text-[10px] uppercase tracking-wide transition ${
              active
                ? "text-term-green shadow-[inset_0_2px_0_0_#3ddc97]"
                : "text-term-dim hover:text-term-text"
            }`}
            aria-current={active ? "page" : undefined}
          >
            <Icon className="h-[18px] w-[18px]" />
            {tab}
          </button>
        );
      })}
    </nav>
  );
}
