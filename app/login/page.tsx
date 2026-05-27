import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { SignInButton } from "@/components/sign-in-button";

export default async function LoginPage() {
  const session = await getServerSession(authOptions);
  if (session) redirect("/");

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="border border-term-border bg-term-panel/80 p-8 shadow-glow-sm backdrop-blur">
          <div className="mb-8 text-center">
            <p className="mb-3 font-mono text-xs uppercase tracking-[0.4em] text-term-dim">
              <span className="text-term-green">$</span> control plane
            </p>
            <h1 className="font-heading text-4xl font-bold uppercase tracking-[0.2em] text-term-text">
              AGENT<span className="text-term-green">CTL</span>
              <span className="ml-0.5 inline-block h-7 w-[3px] translate-y-1 animate-blink bg-term-green align-middle" />
            </h1>
            <p className="mt-4 text-sm text-term-dim">
              Authenticate to access your repositories.
            </p>
          </div>

          <SignInButton />

          <p className="mt-6 text-center text-[11px] leading-relaxed text-term-dim">
            Uses GitHub OAuth. We request{" "}
            <span className="text-term-text/80">repo</span> access to manage
            your repositories.
          </p>
        </div>
      </div>
    </main>
  );
}
