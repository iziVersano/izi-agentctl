"use client";

import { signOut } from "next-auth/react";
import { SignOutIcon } from "@/components/icons";

export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/login" })}
      title="Sign out"
      className="flex items-center gap-2 border border-term-border px-3 py-2 font-mono text-xs uppercase tracking-wider text-term-dim transition hover:border-red-500/50 hover:text-red-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50"
    >
      <SignOutIcon className="h-4 w-4" />
      <span className="hidden sm:inline">Sign out</span>
    </button>
  );
}
