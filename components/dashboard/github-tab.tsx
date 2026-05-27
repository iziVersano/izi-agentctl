"use client";

import { useCallback, useEffect, useState } from "react";
import type { Repo } from "@/lib/constants";
import type { GitHubItem } from "@/types/github";
import { timeAgo } from "@/lib/time-ago";

type ListState = {
  items: GitHubItem[];
  loading: boolean;
  error: string | null;
};

const EMPTY: ListState = { items: [], loading: true, error: null };

export function GitHubTab({ repo }: { repo: Repo }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [autoClaude, setAutoClaude] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<{
    kind: "ok" | "err";
    text: string;
  } | null>(null);

  const [pulls, setPulls] = useState<ListState>(EMPTY);
  const [issues, setIssues] = useState<ListState>(EMPTY);

  const loadList = useCallback(
    async (
      kind: "pulls" | "issues",
      set: (s: ListState) => void,
      signal: AbortSignal,
    ) => {
      set({ items: [], loading: true, error: null });
      try {
        const res = await fetch(
          `/api/github/${kind}?repo=${encodeURIComponent(repo)}`,
          { signal },
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
        set({ items: data.items ?? [], loading: false, error: null });
      } catch (err) {
        if (signal.aborted) return;
        set({
          items: [],
          loading: false,
          error: err instanceof Error ? err.message : "Failed to load",
        });
      }
    },
    [repo],
  );

  const refreshLists = useCallback(
    (signal: AbortSignal) => {
      loadList("pulls", setPulls, signal);
      loadList("issues", setIssues, signal);
    },
    [loadList],
  );

  // (Re)load both lists whenever the selected repo changes.
  useEffect(() => {
    const ctrl = new AbortController();
    refreshLists(ctrl.signal);
    return () => ctrl.abort();
  }, [refreshLists]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || submitting) return;
    setSubmitting(true);
    setNotice(null);
    try {
      const res = await fetch("/api/github/create-issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repo,
          title: title.trim(),
          body,
          autoTriggerClaude: autoClaude,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);

      setNotice({
        kind: "ok",
        text: autoClaude
          ? data.claudeTriggered
            ? `Issue #${data.number} created — @claude triggered`
            : `Issue #${data.number} created — @claude comment failed`
          : `Issue #${data.number} created`,
      });
      setTitle("");
      setBody("");
      setAutoClaude(false);
      // Reflect the new issue in the list.
      const ctrl = new AbortController();
      loadList("issues", setIssues, ctrl.signal);
    } catch (err) {
      setNotice({
        kind: "err",
        text: err instanceof Error ? err.message : "Failed to create issue",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="flex h-full flex-col p-5 sm:p-8">
      {/* Breadcrumb / command line */}
      <p className="mb-6 font-mono text-xs text-term-dim">
        <span className="text-term-green">agentctl</span>
        <span className="text-term-dim"> ~/{repo} </span>
        <span className="text-term-green">$</span> github
      </p>

      <div className="mx-auto w-full max-w-3xl space-y-8">
        {/* ── Create Issue form ─────────────────────────────── */}
        <form
          onSubmit={handleSubmit}
          className="border border-term-border bg-term-panel/60"
        >
          <header className="border-b border-term-border px-5 py-3">
            <h3 className="font-mono text-[11px] uppercase tracking-[0.25em] text-term-green">
              // create issue
            </h3>
          </header>

          <div className="space-y-4 p-5">
            <Field label="repo">
              <span className="block w-full border border-term-border bg-term-elevated px-3 py-2 font-mono text-sm text-term-text/90">
                {repo}
              </span>
            </Field>

            <Field label="title">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Short, descriptive title"
                className="w-full border border-term-border bg-term-elevated px-3 py-2 font-mono text-sm text-term-text placeholder:text-term-dim/60 focus:border-term-green focus:outline-none focus:shadow-glow-sm"
              />
            </Field>

            <Field label="body">
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={5}
                placeholder="Describe the task. Markdown supported."
                className="w-full resize-y border border-term-border bg-term-elevated px-3 py-2 font-mono text-sm text-term-text placeholder:text-term-dim/60 focus:border-term-green focus:outline-none focus:shadow-glow-sm"
              />
            </Field>

            <label className="flex cursor-pointer select-none items-center gap-2.5 font-mono text-sm text-term-text/90">
              <input
                type="checkbox"
                checked={autoClaude}
                onChange={(e) => setAutoClaude(e.target.checked)}
                className="h-4 w-4 cursor-pointer accent-term-green"
              />
              Auto-trigger Claude
              <span className="text-term-dim">
                (adds <span className="text-term-green">@claude</span> as first
                comment)
              </span>
            </label>

            <div className="flex items-center gap-4 pt-1">
              <button
                type="submit"
                disabled={submitting || !title.trim()}
                className="border border-term-green bg-term-green/10 px-5 py-2 font-mono text-[13px] uppercase tracking-wide text-term-green transition hover:bg-term-green/20 hover:shadow-glow-sm disabled:cursor-not-allowed disabled:border-term-border disabled:bg-transparent disabled:text-term-dim disabled:shadow-none"
              >
                {submitting ? "creating…" : "create issue"}
              </button>

              {notice && (
                <span
                  className={`font-mono text-xs ${
                    notice.kind === "ok" ? "text-term-green" : "text-red-400"
                  }`}
                >
                  {notice.text}
                </span>
              )}
            </div>
          </div>
        </form>

        {/* ── Lists ─────────────────────────────────────────── */}
        <div className="grid gap-6 md:grid-cols-2">
          <ItemList title="open prs" state={pulls} />
          <ItemList title="open issues" state={issues} />
        </div>
      </div>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.25em] text-term-dim">
        {label}
      </span>
      {children}
    </label>
  );
}

function ItemList({ title, state }: { title: string; state: ListState }) {
  return (
    <div className="border border-term-border bg-term-panel/60">
      <header className="flex items-center justify-between border-b border-term-border px-4 py-3">
        <h3 className="font-mono text-[11px] uppercase tracking-[0.25em] text-term-green">
          // {title}
        </h3>
        {!state.loading && !state.error && (
          <span className="font-mono text-[11px] text-term-dim">
            {state.items.length}
          </span>
        )}
      </header>

      <div className="divide-y divide-term-border">
        {state.loading && <Hint>loading…</Hint>}
        {state.error && <Hint tone="err">{state.error}</Hint>}
        {!state.loading && !state.error && state.items.length === 0 && (
          <Hint>nothing open</Hint>
        )}
        {!state.loading &&
          !state.error &&
          state.items.map((item) => <Row key={item.id} item={item} />)}
      </div>
    </div>
  );
}

function Row({ item }: { item: GitHubItem }) {
  return (
    <a
      href={item.htmlUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group block px-4 py-3 transition hover:bg-term-elevated"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 flex-1 truncate font-mono text-sm text-term-text group-hover:text-term-green-bright">
          {item.title}
        </p>
        <StatusBadge state={item.state} />
      </div>
      <p className="mt-1 font-mono text-[11px] text-term-dim">
        #{item.number} · {item.author} · {timeAgo(item.createdAt)}
      </p>
    </a>
  );
}

const BADGE: Record<GitHubItem["state"], string> = {
  open: "border-term-green/50 text-term-green",
  merged: "border-purple-400/50 text-purple-300",
  draft: "border-term-dim/60 text-term-dim",
  closed: "border-red-400/50 text-red-300",
};

function StatusBadge({ state }: { state: GitHubItem["state"] }) {
  return (
    <span
      className={`shrink-0 border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${BADGE[state]}`}
    >
      {state}
    </span>
  );
}

function Hint({
  children,
  tone = "dim",
}: {
  children: React.ReactNode;
  tone?: "dim" | "err";
}) {
  return (
    <p
      className={`px-4 py-6 text-center font-mono text-xs ${
        tone === "err" ? "text-red-400" : "text-term-dim"
      }`}
    >
      {children}
    </p>
  );
}
