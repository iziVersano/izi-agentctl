"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { GitHubIcon } from "@/components/icons-github";

export function SignInButton() {
  const [loading, setLoading] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        setLoading(true);
        signIn("github", { callbackUrl: "/" });
      }}
      disabled={loading}
      className="group flex w-full items-center justify-center gap-3 border border-term-green/40 bg-term-green/10 px-5 py-3 font-mono text-sm font-bold uppercase tracking-wider text-term-green transition hover:bg-term-green/20 hover:shadow-glow focus:outline-none focus-visible:ring-2 focus-visible:ring-term-green/60 disabled:cursor-wait disabled:opacity-60"
    >
      <GitHubIcon className="h-5 w-5" />
      {loading ? "Connecting…" : "Sign in with GitHub"}
    </button>
  );
}
