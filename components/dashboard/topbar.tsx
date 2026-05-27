"use client";

import Image from "next/image";
import type { Repo } from "@/lib/constants";
import { MenuIcon } from "@/components/icons";
import { SignOutButton } from "@/components/sign-out-button";

type TopbarProps = {
  activeRepo: Repo;
  user: { name: string | null; image: string | null };
  onOpenMenu: () => void;
};

export function Topbar({ activeRepo, user, onOpenMenu }: TopbarProps) {
  const initial = (user.name ?? "?").charAt(0).toUpperCase();

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-term-border bg-term-panel/70 px-4 backdrop-blur sm:px-6">
      <button
        type="button"
        onClick={onOpenMenu}
        className="text-term-dim hover:text-term-text md:hidden"
        aria-label="Open menu"
      >
        <MenuIcon className="h-6 w-6" />
      </button>

      {/* Active repo */}
      <div className="flex min-w-0 items-center gap-2">
        <span className="hidden font-mono text-xs text-term-dim sm:inline">
          repo<span className="text-term-green">:</span>
        </span>
        <span className="truncate font-heading text-lg font-semibold tracking-wide text-term-text">
          {activeRepo}
        </span>
      </div>

      {/* User */}
      <div className="ml-auto flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          {user.image ? (
            <Image
              src={user.image}
              alt={user.name ?? "User avatar"}
              width={32}
              height={32}
              className="h-8 w-8 rounded-full border border-term-border"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-term-green/40 bg-term-green/10 font-mono text-sm text-term-green">
              {initial}
            </div>
          )}
          <span className="hidden font-mono text-sm text-term-text sm:inline">
            {user.name ?? "unknown"}
          </span>
        </div>
        <SignOutButton />
      </div>
    </header>
  );
}
