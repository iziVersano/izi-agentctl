"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { REPOS, type Repo } from "@/lib/constants";
import { RepoIcon } from "@/components/icons";
import type { GitHubItem } from "@/types/github";
import { timeAgo } from "@/lib/time-ago";

type ListState = {
  items: GitHubItem[];
  loading: boolean;
  error: string | null;
};

type DraftState = {
  title: string;
  body: string;
  autoClaude: boolean;
  submitting: boolean;
  notice: { kind: "ok" | "err"; text: string } | null;
};

const EMPTY_LIST: ListState = { items: [], loading: true, error: null };
const EMPTY_DRAFT: DraftState = {
  title: "",
  body: "",
  autoClaude: false,
  submitting: false,
  notice: null,
};

type ListMap = Record<Repo, ListState>;
type DraftMap = Record<Repo, DraftState>;

const initialLists = (): ListMap =>
  Object.fromEntries(REPOS.map((r) => [r, EMPTY_LIST])) as ListMap;
const initialDrafts = (): DraftMap =>
  Object.fromEntries(REPOS.map((r) => [r, EMPTY_DRAFT])) as DraftMap;

export function DashboardTab() {
  const [lists, setLists] = useState<ListMap>(initialLists);
  const [drafts, setDrafts] = useState<DraftMap>(initialDrafts);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const ctrlRef = useRef<AbortController | null>(null);

  const fetchOne = useCallback(
    async (repo: Repo, signal: AbortSignal): Promise<ListState> => {
      try {
        const res = await fetch(
          `/api/github/issues?repo=${encodeURIComponent(repo)}`,
          { signal },
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
        return { items: data.items ?? [], loading: false, error: null };
      } catch (err) {
        if (signal.aborted) {
          return { items: [], loading: true, error: null };
        }
        return {
          items: [],
          loading: false,
          error: err instanceof Error ? err.message : "Failed to load",
        };
      }
    },
    [],
  );

  const loadAll = useCallback(async () => {
    ctrlRef.current?.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;

    // Set every cell to loading without dropping any cached items already on screen.
    setLists((prev) =>
      Object.fromEntries(
        REPOS.map((r) => [r, { ...prev[r], loading: true, error: null }]),
      ) as ListMap,
    );

    // Fire all 6 in parallel; settle each cell independently as it returns.
    await Promise.allSettled(
      REPOS.map(async (repo) => {
        const next = await fetchOne(repo, ctrl.signal);
        if (ctrl.signal.aborted) return;
        setLists((prev) => ({ ...prev, [repo]: next }));
      }),
    );

    if (!ctrl.signal.aborted) setLastSync(Date.now());
  }, [fetchOne]);

  // Initial load + refresh on focus/visibility.
  useEffect(() => {
    loadAll();

    const onFocus = () => {
      if (document.visibilityState === "visible") loadAll();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    return () => {
      ctrlRef.current?.abort();
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [loadAll]);

  const updateDraft = useCallback((repo: Repo, patch: Partial<DraftState>) => {
    setDrafts((prev) => ({ ...prev, [repo]: { ...prev[repo], ...patch } }));
  }, []);

  const submitIssue = useCallback(
    async (repo: Repo) => {
      setDrafts((prev) => {
        const d = prev[repo];
        if (!d.title.trim() || d.submitting) return prev;
        return {
          ...prev,
          [repo]: { ...d, submitting: true, notice: null },
        };
      });

      const draft = drafts[repo];
      const title = draft.title.trim();
      if (!title || draft.submitting) return;

      try {
        const res = await fetch("/api/github/create-issue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            repo,
            title,
            body: draft.body,
            autoTriggerClaude: draft.autoClaude,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);

        // Optimistic prepend so the cell reflects the new issue immediately.
        const newIssue: GitHubItem = {
          id: data.number,
          number: data.number,
          title,
          author: "you",
          createdAt: new Date().toISOString(),
          state: "open",
          htmlUrl: data.htmlUrl,
        };
        setLists((prev) => ({
          ...prev,
          [repo]: {
            ...prev[repo],
            items: [newIssue, ...prev[repo].items],
          },
        }));

        updateDraft(repo, {
          title: "",
          body: "",
          autoClaude: false,
          submitting: false,
          notice: {
            kind: "ok",
            text: draft.autoClaude
              ? data.claudeTriggered
                ? `#${data.number} created · @claude triggered`
                : `#${data.number} created · @claude failed`
              : `#${data.number} created`,
          },
        });
      } catch (err) {
        updateDraft(repo, {
          submitting: false,
          notice: {
            kind: "err",
            text: err instanceof Error ? err.message : "Failed",
          },
        });
      }
    },
    [drafts, updateDraft],
  );

  return (
    <section className="flex h-full flex-col p-5 sm:p-8">
      <header className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs text-term-dim">
            <span className="text-term-green">agentctl</span>
            <span className="text-term-dim"> ~ </span>
            <span className="text-term-green">$</span> dashboard
          </p>
          <p className="mt-1 font-mono text-[11px] text-term-dim">
            {lastSync
              ? `synced ${timeAgo(new Date(lastSync).toISOString())}`
              : "syncing…"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => loadAll()}
          className="border border-term-border bg-term-panel/60 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-term-text/80 transition hover:border-term-green/50 hover:text-term-green"
        >
          refresh
        </button>
      </header>

      <div className="grid flex-1 grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2 xl:grid-cols-3">
        {REPOS.map((repo) => (
          <RepoCell
            key={repo}
            repo={repo}
            list={lists[repo]}
            draft={drafts[repo]}
            onDraftChange={(patch) => updateDraft(repo, patch)}
            onSubmit={() => submitIssue(repo)}
          />
        ))}
      </div>
    </section>
  );
}

function RepoCell({
  repo,
  list,
  draft,
  onDraftChange,
  onSubmit,
}: {
  repo: Repo;
  list: ListState;
  draft: DraftState;
  onDraftChange: (patch: Partial<DraftState>) => void;
  onSubmit: () => void;
}) {
  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    // Cmd/Ctrl+Enter submits from either field.
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="flex flex-col border border-term-border bg-term-panel/60">
      <header className="flex items-center justify-between border-b border-term-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <RepoIcon className="h-4 w-4 shrink-0 text-term-green" />
          <span className="truncate font-mono text-[13px] text-term-text">
            {repo}
          </span>
        </div>
        <CountBadge list={list} />
      </header>

      {/* Open issues list */}
      <div className="max-h-56 overflow-y-auto">
        {list.loading && list.items.length === 0 && (
          <Hint>loading…</Hint>
        )}
        {list.error && !list.loading && <Hint tone="err">{list.error}</Hint>}
        {!list.loading && !list.error && list.items.length === 0 && (
          <Hint>no open issues</Hint>
        )}
        {list.items.length > 0 && (
          <ul className="divide-y divide-term-border/60">
            {list.items.map((item) => (
              <li key={item.id}>
                <a
                  href={item.htmlUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block px-4 py-2.5 transition hover:bg-term-elevated"
                >
                  <p className="truncate font-mono text-[12.5px] text-term-text group-hover:text-term-green-bright">
                    {item.title}
                  </p>
                  <p className="mt-0.5 font-mono text-[10.5px] text-term-dim">
                    #{item.number} · {item.author} · {timeAgo(item.createdAt)}
                  </p>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* New issue form */}
      <div className="space-y-2.5 border-t border-term-border bg-term-elevated/40 p-3">
        <div>
          <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.2em] text-term-dim">
            title
          </span>
          <input
            type="text"
            value={draft.title}
            onChange={(e) => onDraftChange({ title: e.target.value })}
            onKeyDown={handleKeyDown}
            placeholder="Short, descriptive title"
            className="w-full border border-term-border bg-term-elevated px-2.5 py-1.5 font-mono text-[12.5px] text-term-text placeholder:text-term-dim/60 focus:border-term-green focus:outline-none focus:shadow-glow-sm"
          />
        </div>

        <div>
          <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.2em] text-term-dim">
            body
          </span>
          <textarea
            value={draft.body}
            onChange={(e) => onDraftChange({ body: e.target.value })}
            onKeyDown={handleKeyDown}
            rows={3}
            placeholder="Describe the task. Markdown supported."
            className="w-full resize-y border border-term-border bg-term-elevated px-2.5 py-1.5 font-mono text-[12.5px] text-term-text placeholder:text-term-dim/60 focus:border-term-green focus:outline-none focus:shadow-glow-sm"
          />
        </div>

        <div className="flex items-center justify-between gap-2">
          <label className="flex cursor-pointer select-none items-center gap-1.5 font-mono text-[10.5px] text-term-dim">
            <input
              type="checkbox"
              checked={draft.autoClaude}
              onChange={(e) => onDraftChange({ autoClaude: e.target.checked })}
              className="h-3 w-3 cursor-pointer accent-term-green"
            />
            <span>
              auto-trigger <span className="text-term-green">@claude</span>
            </span>
          </label>
          <button
            type="button"
            onClick={onSubmit}
            disabled={draft.submitting || !draft.title.trim()}
            className="border border-term-green/60 bg-term-green/10 px-3 py-1 font-mono text-[10.5px] uppercase tracking-wider text-term-green transition hover:bg-term-green/20 disabled:cursor-not-allowed disabled:border-term-border disabled:bg-transparent disabled:text-term-dim"
          >
            {draft.submitting ? "creating…" : "create issue"}
          </button>
        </div>

        {draft.notice && (
          <p
            className={`truncate font-mono text-[10.5px] ${
              draft.notice.kind === "ok" ? "text-term-green" : "text-red-400"
            }`}
            title={draft.notice.text}
          >
            {draft.notice.text}
          </p>
        )}
      </div>
    </div>
  );
}

function CountBadge({ list }: { list: ListState }) {
  if (list.loading && list.items.length === 0) {
    return <span className="font-mono text-[10.5px] text-term-dim">…</span>;
  }
  if (list.error) {
    return (
      <span className="border border-red-400/40 px-1.5 py-0.5 font-mono text-[10px] text-red-300">
        err
      </span>
    );
  }
  return (
    <span className="font-mono text-[10.5px] text-term-dim">
      <span className="text-term-text">{list.items.length}</span> open
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
      className={`px-4 py-6 text-center font-mono text-[11px] ${
        tone === "err" ? "text-red-400" : "text-term-dim"
      }`}
    >
      {children}
    </p>
  );
}
