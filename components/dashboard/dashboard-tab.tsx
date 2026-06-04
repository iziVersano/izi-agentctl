"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { REPOS, type Repo } from "@/lib/constants";
import { RepoIcon } from "@/components/icons";
import type { GitHubItem } from "@/types/github";
import type { RepoMeta } from "@/app/api/github/repo-meta/route";
import { timeAgo } from "@/lib/time-ago";

type ListState = {
  items: GitHubItem[];
  loading: boolean;
  error: string | null;
};

type MetaState = {
  meta: RepoMeta | null;
  loading: boolean;
};

const EMPTY_META: MetaState = { meta: null, loading: true };
type MetaMap = Record<Repo, MetaState>;

const LAST_VISIT_KEY = "agentctl:dashboard:lastVisitedAt";

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
const initialMetas = (): MetaMap =>
  Object.fromEntries(REPOS.map((r) => [r, EMPTY_META])) as MetaMap;

// Subtle gradient washes — picked deterministically per repo name so the
// grid looks varied without jumping around between renders. Tints stay low
// opacity to preserve the dark terminal aesthetic.
const TILE_GRADIENTS = [
  "radial-gradient(120% 80% at 100% 0%, rgba(61,220,151,0.10), transparent 60%)",   // green
  "radial-gradient(120% 80% at 0% 100%, rgba(80,170,255,0.10), transparent 60%)",   // blue
  "radial-gradient(120% 80% at 100% 100%, rgba(180,130,255,0.10), transparent 60%)", // purple
  "radial-gradient(120% 80% at 0% 0%, rgba(255,170,90,0.08), transparent 60%)",     // amber
  "radial-gradient(120% 80% at 100% 0%, rgba(255,110,160,0.08), transparent 60%)",  // pink
  "radial-gradient(120% 80% at 0% 100%, rgba(110,220,220,0.10), transparent 60%)",  // cyan
] as const;

function tileGradient(repo: string): string {
  // djb2 hash — small, stable, no deps.
  let h = 5381;
  for (let i = 0; i < repo.length; i++) {
    h = ((h << 5) + h + repo.charCodeAt(i)) | 0;
  }
  return TILE_GRADIENTS[Math.abs(h) % TILE_GRADIENTS.length];
}

// CI state → left-accent bar color. Drives the strongest "is this repo
// healthy" signal on the tile.
function ciAccent(state: RepoMeta["ci"]["state"]): string {
  switch (state) {
    case "success":
      return "bg-term-green";
    case "failure":
      return "bg-red-400";
    case "pending":
      return "bg-amber-400 animate-pulse";
    case "neutral":
    case "skipped":
    case "cancelled":
      return "bg-term-dim/60";
    default:
      return "bg-term-border";
  }
}

// Open-issue count → badge tone. Visual heat map of where work is piling up.
function issueHeat(count: number): { text: string; border: string } {
  if (count === 0) return { text: "text-term-green", border: "border-term-green/40" };
  if (count <= 3) return { text: "text-amber-300", border: "border-amber-400/40" };
  if (count <= 8) return { text: "text-orange-300", border: "border-orange-400/50" };
  return { text: "text-red-300", border: "border-red-400/50" };
}

// Foreground color (b/w) for a given GitHub label color, so dark labels get
// white text and pale labels get black. Standard YIQ luma heuristic.
function labelTextColor(hex: string): string {
  if (!/^[0-9a-f]{6}$/i.test(hex)) return "#fff";
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 140 ? "#0a0a0a" : "#ffffff";
}

// Create-issue button styling driven by form state — disabled / ready /
// submitting / post-success / post-error. Keeping this off the JSX makes
// the lifecycle easy to read in one place.
function buttonClass(draft: DraftState): string {
  const base =
    "border px-3 py-1 font-mono text-[10.5px] uppercase tracking-wider transition";
  if (!draft.title.trim()) {
    return `${base} cursor-not-allowed border-term-border bg-transparent text-term-dim`;
  }
  if (draft.submitting) {
    return `${base} animate-pulse border-amber-400/60 bg-amber-400/15 text-amber-300`;
  }
  if (draft.notice?.kind === "ok") {
    return `${base} border-term-green bg-term-green/20 text-term-green hover:bg-term-green/30`;
  }
  if (draft.notice?.kind === "err") {
    return `${base} border-red-400/70 bg-red-500/15 text-red-300 hover:bg-red-500/25`;
  }
  return `${base} border-term-green/60 bg-term-green/10 text-term-green hover:bg-term-green/20`;
}

function buttonLabel(draft: DraftState): string {
  if (draft.submitting) return "creating…";
  if (draft.notice?.kind === "ok") return "create another";
  if (draft.notice?.kind === "err") return "retry";
  return "create issue";
}

export function DashboardTab() {
  const [lists, setLists] = useState<ListMap>(initialLists);
  const [metas, setMetas] = useState<MetaMap>(initialMetas);
  const [drafts, setDrafts] = useState<DraftMap>(initialDrafts);
  const [lastSync, setLastSync] = useState<number | null>(null);
  // Snapshot of "previous visit" timestamp taken once at mount. Cells compare
  // commit/issue dates against this to render the "new since last visit" pip.
  // The CURRENT visit's timestamp gets written back on unmount so the next
  // render sees this session's activity as the new baseline.
  const lastVisitRef = useRef<number>(0);
  const ctrlRef = useRef<AbortController | null>(null);

  const fetchIssues = useCallback(
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

  const fetchMeta = useCallback(
    async (repo: Repo, signal: AbortSignal): Promise<MetaState> => {
      try {
        const res = await fetch(
          `/api/github/repo-meta?repo=${encodeURIComponent(repo)}`,
          { signal },
        );
        if (!res.ok) return { meta: null, loading: false };
        const data = (await res.json()) as RepoMeta;
        return { meta: data, loading: false };
      } catch {
        if (signal.aborted) return { meta: null, loading: true };
        return { meta: null, loading: false };
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
    setMetas((prev) =>
      Object.fromEntries(
        REPOS.map((r) => [r, { ...prev[r], loading: true }]),
      ) as MetaMap,
    );

    // Fire 2 endpoints × 6 repos in parallel; settle each piece independently.
    await Promise.allSettled([
      ...REPOS.map(async (repo) => {
        const next = await fetchIssues(repo, ctrl.signal);
        if (ctrl.signal.aborted) return;
        setLists((prev) => ({ ...prev, [repo]: next }));
      }),
      ...REPOS.map(async (repo) => {
        const next = await fetchMeta(repo, ctrl.signal);
        if (ctrl.signal.aborted) return;
        setMetas((prev) => ({ ...prev, [repo]: next }));
      }),
    ]);

    if (!ctrl.signal.aborted) setLastSync(Date.now());
  }, [fetchIssues, fetchMeta]);

  // Initial load + refresh on focus/visibility. Also snapshots and updates
  // the persisted lastVisitedAt timestamp used by the "new since last visit" pip.
  useEffect(() => {
    const stored = localStorage.getItem(LAST_VISIT_KEY);
    lastVisitRef.current = stored ? Number(stored) || 0 : 0;

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
      // Record THIS visit's wall-clock as the new baseline for next time.
      localStorage.setItem(LAST_VISIT_KEY, String(Date.now()));
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
          labels: [],
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
            meta={metas[repo]}
            draft={drafts[repo]}
            lastVisitAt={lastVisitRef.current}
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
  meta,
  draft,
  lastVisitAt,
  onDraftChange,
  onSubmit,
}: {
  repo: Repo;
  list: ListState;
  meta: MetaState;
  draft: DraftState;
  lastVisitAt: number;
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

  // "New since last visit" — any commit or issue more recent than the stored
  // last-visit baseline. Skipped on the first ever visit (lastVisitAt === 0)
  // so brand-new users don't see every tile lit up.
  const hasNewActivity = useMemo(() => {
    if (!lastVisitAt) return false;
    const commitAt = meta.meta?.latestCommit?.date
      ? new Date(meta.meta.latestCommit.date).getTime()
      : 0;
    const newestIssueAt = list.items[0]?.createdAt
      ? new Date(list.items[0].createdAt).getTime()
      : 0;
    return commitAt > lastVisitAt || newestIssueAt > lastVisitAt;
  }, [lastVisitAt, meta.meta, list.items]);

  const ciState = meta.meta?.ci.state ?? null;
  const accentClass = ciAccent(ciState);
  // Pulsing outline only when there's NEW activity AND this isn't the first visit.
  // Sits above the gradient and below the CI accent bar visually.
  const outlineClass = hasNewActivity
    ? "ring-1 ring-term-green/60 ring-offset-0 shadow-[0_0_18px_-2px_rgba(61,220,151,0.35)]"
    : "";

  return (
    <div
      className={`relative flex flex-col overflow-hidden border border-term-border bg-term-panel/60 ${outlineClass}`}
      style={{ backgroundImage: tileGradient(repo) }}
    >
      {/* CI-driven left accent bar */}
      <span
        className={`absolute inset-y-0 left-0 w-[3px] ${accentClass}`}
        aria-hidden
      />

      <header className="flex items-center justify-between border-b border-term-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <RepoIcon className="h-4 w-4 shrink-0 text-term-green" />
          <span className="truncate font-mono text-[13px] text-term-text">
            {repo}
          </span>
          {hasNewActivity && (
            <span
              className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-term-green shadow-glow-sm"
              title="New activity since your last visit"
              aria-label="New activity since your last visit"
            />
          )}
        </div>
        <CountBadge list={list} />
      </header>

      {/* Activity row: latest commit, open PRs, CI status */}
      <ActivityRow repo={repo} meta={meta} />


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
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10.5px] text-term-dim">
                    <span>
                      #{item.number} · {item.author} · {timeAgo(item.createdAt)}
                    </span>
                    {item.labels.length > 0 && (
                      <span className="flex flex-wrap items-center gap-1">
                        {item.labels.slice(0, 3).map((label) => (
                          <span
                            key={label.name}
                            className="rounded-full px-1.5 py-px text-[9.5px] font-medium"
                            style={{
                              backgroundColor: `#${label.color}`,
                              color: labelTextColor(label.color),
                            }}
                            title={label.name}
                          >
                            {label.name}
                          </span>
                        ))}
                        {item.labels.length > 3 && (
                          <span className="text-term-dim/70">
                            +{item.labels.length - 3}
                          </span>
                        )}
                      </span>
                    )}
                  </div>
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
            className={buttonClass(draft)}
          >
            {buttonLabel(draft)}
          </button>
        </div>

        {draft.notice && (
          <p
            className={`truncate border px-2 py-1 font-mono text-[10.5px] ${
              draft.notice.kind === "ok"
                ? "border-term-green/40 bg-term-green/10 text-term-green"
                : "border-red-400/50 bg-red-500/10 text-red-300"
            }`}
            title={draft.notice.text}
          >
            {draft.notice.kind === "ok" ? "✓ " : "× "}
            {draft.notice.text}
          </p>
        )}
      </div>
    </div>
  );
}

function ActivityRow({ repo: _repo, meta }: { repo: Repo; meta: MetaState }) {
  if (meta.loading && !meta.meta) {
    return (
      <div className="border-b border-term-border/60 px-4 py-2 font-mono text-[10.5px] text-term-dim">
        loading activity…
      </div>
    );
  }
  if (!meta.meta) {
    return (
      <div className="border-b border-term-border/60 px-4 py-2 font-mono text-[10.5px] text-term-dim/70">
        activity unavailable
      </div>
    );
  }

  const { latestCommit, openPrCount, ci } = meta.meta;

  return (
    <div className="space-y-1.5 border-b border-term-border/60 bg-term-elevated/30 px-4 py-2.5">
      {/* Top line: latest commit */}
      <div className="flex items-center gap-2 font-mono text-[11px]">
        <span className="shrink-0 text-term-dim/80">last commit</span>
        {latestCommit ? (
          <a
            href={latestCommit.htmlUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="min-w-0 flex-1 truncate text-term-text transition hover:text-term-green-bright"
            title={latestCommit.message}
          >
            <span className="text-term-green">{latestCommit.author}</span>
            <span className="text-term-dim"> · {timeAgo(latestCommit.date)}</span>
          </a>
        ) : (
          <span className="text-term-dim/70">—</span>
        )}
      </div>

      {/* Bottom line: PRs + CI badge (always visible) */}
      <div className="flex items-center gap-3 font-mono text-[11px]">
        <span className="flex items-center gap-1.5">
          <span className="text-term-dim/80">prs</span>
          <span
            className={openPrCount > 0 ? "text-term-text" : "text-term-dim/60"}
          >
            {openPrCount}
          </span>
        </span>

        <CIBadge ci={ci} />
      </div>
    </div>
  );
}

function CIBadge({ ci }: { ci: RepoMeta["ci"] }) {
  // (color classes, label text) per state — kept text-readable, not dot-only.
  const map: Record<
    NonNullable<RepoMeta["ci"]["state"]> | "none",
    { wrap: string; dot: string; label: string }
  > = {
    success: {
      wrap: "border-term-green/50 text-term-green",
      dot: "bg-term-green shadow-glow-sm",
      label: "passing",
    },
    failure: {
      wrap: "border-red-400/60 text-red-300",
      dot: "bg-red-400 shadow-[0_0_8px_-1px_rgba(248,113,113,0.6)]",
      label: "failing",
    },
    pending: {
      wrap: "border-amber-400/50 text-amber-300",
      dot: "bg-amber-400 animate-pulse",
      label: "running",
    },
    neutral: {
      wrap: "border-term-border text-term-dim",
      dot: "bg-term-dim",
      label: "neutral",
    },
    skipped: {
      wrap: "border-term-border text-term-dim/70",
      dot: "bg-term-dim/50",
      label: "skipped",
    },
    cancelled: {
      wrap: "border-term-border text-term-dim/70",
      dot: "bg-term-dim/50",
      label: "cancelled",
    },
    none: {
      wrap: "border-term-border text-term-dim/60",
      dot: "bg-term-dim/30",
      label: "no ci",
    },
  };

  const key = (ci.state ?? "none") as keyof typeof map;
  const { wrap, dot, label } = map[key];

  const inner = (
    <span
      className={`inline-flex items-center gap-1.5 border px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${wrap}`}
      title={`CI: ${label}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      ci {label}
    </span>
  );

  return ci.htmlUrl ? (
    <a href={ci.htmlUrl} target="_blank" rel="noopener noreferrer">
      {inner}
    </a>
  ) : (
    inner
  );
}

function CountBadge({ list }: { list: ListState }) {
  if (list.loading && list.items.length === 0) {
    return <span className="font-mono text-[10.5px] text-term-dim">…</span>;
  }
  if (list.error) {
    return (
      <span className="border border-red-400/40 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-red-300">
        err
      </span>
    );
  }
  const heat = issueHeat(list.items.length);
  return (
    <span
      className={`border px-1.5 py-0.5 font-mono text-[10.5px] uppercase tracking-wider ${heat.border} ${heat.text}`}
    >
      {list.items.length} open
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
