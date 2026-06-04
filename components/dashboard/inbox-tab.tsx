"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { REPOS, type Repo } from "@/lib/constants";
import { timeAgo } from "@/lib/time-ago";
import { dispatchIssueCreated } from "@/lib/events";
import type { InboxItem } from "@/app/api/telegram/inbox/route";

const DISMISSED_KEY = "agentctl:inbox:dismissed";
const FILED_KEY = "agentctl:inbox:filed";

type LoadState = {
  items: InboxItem[];
  loading: boolean;
  error: string | null;
};

type FileResult =
  | { kind: "ok"; repo: Repo; number: number; htmlUrl: string }
  | { kind: "err"; text: string };

/** Per-card draft for the file-as-issue form. */
type Draft = {
  repo: Repo;
  title: string;
  body: string;
  submitting: boolean;
  result: FileResult | null;
};

const EMPTY_LOAD: LoadState = { items: [], loading: true, error: null };

/** Read a string-keyed set from localStorage. Tolerates missing/corrupt. */
function readSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    return Array.isArray(arr) ? new Set(arr.map(String)) : new Set();
  } catch {
    return new Set();
  }
}

function writeSet(key: string, value: Set<string>) {
  try {
    localStorage.setItem(key, JSON.stringify([...value]));
  } catch {
    // localStorage quota — ignore, worst case the user re-dismisses next visit.
  }
}

export function InboxTab() {
  const [load, setLoad] = useState<LoadState>(EMPTY_LOAD);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [filed, setFiled] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [lastSync, setLastSync] = useState<number | null>(null);
  const ctrlRef = useRef<AbortController | null>(null);

  const fetchInbox = useCallback(async () => {
    ctrlRef.current?.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;

    setLoad((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const res = await fetch("/api/telegram/inbox", { signal: ctrl.signal });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      if (ctrl.signal.aborted) return;
      setLoad({ items: data.items ?? [], loading: false, error: null });
      setLastSync(Date.now());
    } catch (err) {
      if (ctrl.signal.aborted) return;
      setLoad({
        items: [],
        loading: false,
        error: err instanceof Error ? err.message : "Failed to load",
      });
    }
  }, []);

  // Mount: hydrate localStorage sets, fire initial fetch, wire focus refresh.
  useEffect(() => {
    setDismissed(readSet(DISMISSED_KEY));
    setFiled(readSet(FILED_KEY));
    fetchInbox();

    const onFocus = () => {
      if (document.visibilityState === "visible") fetchInbox();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      ctrlRef.current?.abort();
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [fetchInbox]);

  // Visible items = everything not dismissed and not already filed.
  const visible = useMemo(
    () =>
      load.items.filter(
        (i) => !dismissed.has(String(i.id)) && !filed.has(String(i.id)),
      ),
    [load.items, dismissed, filed],
  );

  const updateDraft = useCallback((id: number, patch: Partial<Draft>) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? defaultDraft(prev[id])), ...patch },
    }));
  }, []);

  const startEditing = useCallback((item: InboxItem) => {
    setDrafts((prev) => {
      if (prev[item.id]) return prev; // already opened
      const lines = item.text.split("\n");
      const title = lines[0].slice(0, 100);
      const body = lines.slice(1).join("\n").trim();
      const initial: Draft = {
        repo: REPOS[0],
        title,
        body: body || `Forwarded from Telegram (${item.from})\n\n${item.text}`,
        submitting: false,
        result: null,
      };
      return { ...prev, [item.id]: initial };
    });
  }, []);

  const cancelEditing = useCallback((id: number) => {
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const dismiss = useCallback((id: number) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(String(id));
      writeSet(DISMISSED_KEY, next);
      return next;
    });
  }, []);

  const fileAsIssue = useCallback(
    async (item: InboxItem) => {
      const draft = drafts[item.id];
      if (!draft || draft.submitting || !draft.title.trim()) return;
      updateDraft(item.id, { submitting: true, result: null });

      try {
        const res = await fetch("/api/github/create-issue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            repo: draft.repo,
            title: draft.title.trim(),
            body: draft.body,
            autoTriggerClaude: false,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);

        // Persist as filed so the card disappears even on refresh.
        setFiled((prev) => {
          const next = new Set(prev);
          next.add(String(item.id));
          writeSet(FILED_KEY, next);
          return next;
        });
        // Tell other tabs (Dashboard) to refetch this repo immediately.
        dispatchIssueCreated({ repo: draft.repo, number: data.number });
        updateDraft(item.id, {
          submitting: false,
          result: {
            kind: "ok",
            repo: draft.repo,
            number: data.number,
            htmlUrl: data.htmlUrl,
          },
        });
      } catch (err) {
        updateDraft(item.id, {
          submitting: false,
          result: {
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
            <span className="text-term-green">$</span> inbox
          </p>
          <p className="mt-1 font-mono text-[11px] text-term-dim">
            {load.loading && !load.items.length
              ? "syncing…"
              : load.error
                ? `error: ${load.error}`
                : `${visible.length} pending · synced ${
                    lastSync
                      ? timeAgo(new Date(lastSync).toISOString())
                      : "—"
                  }`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => fetchInbox()}
          className="border border-term-border bg-term-panel/60 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-term-text/80 transition hover:border-term-green/50 hover:text-term-green"
        >
          refresh
        </button>
      </header>

      {visible.length === 0 && !load.loading && !load.error && (
        <EmptyState />
      )}

      <div className="space-y-4">
        {visible.map((item) => (
          <InboxCard
            key={item.id}
            item={item}
            draft={drafts[item.id]}
            onStartEditing={() => startEditing(item)}
            onCancelEditing={() => cancelEditing(item.id)}
            onDismiss={() => dismiss(item.id)}
            onDraftChange={(patch) => updateDraft(item.id, patch)}
            onFile={() => fileAsIssue(item)}
          />
        ))}
      </div>
    </section>
  );
}

function defaultDraft(_existing: Draft | undefined): Draft {
  return {
    repo: REPOS[0],
    title: "",
    body: "",
    submitting: false,
    result: null,
  };
}

function EmptyState() {
  return (
    <div className="mx-auto mt-12 max-w-md border border-term-border bg-term-panel/40 p-6 text-center">
      <p className="font-mono text-sm text-term-text">no pending messages</p>
      <p className="mt-3 font-mono text-[11px] leading-relaxed text-term-dim">
        forward a whatsapp message to{" "}
        <span className="text-term-green">@Izi_agent_bot</span> on telegram.
        it appears here within seconds (open the tab or hit refresh). then file
        it into the right repo as an issue.
      </p>
    </div>
  );
}

function InboxCard({
  item,
  draft,
  onStartEditing,
  onCancelEditing,
  onDismiss,
  onDraftChange,
  onFile,
}: {
  item: InboxItem;
  draft: Draft | undefined;
  onStartEditing: () => void;
  onCancelEditing: () => void;
  onDismiss: () => void;
  onDraftChange: (patch: Partial<Draft>) => void;
  onFile: () => void;
}) {
  return (
    <article className="border border-term-border bg-term-panel/60">
      <header className="flex items-start justify-between gap-3 border-b border-term-border bg-term-elevated/30 px-4 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[11px] text-term-dim">
            {item.isForward && <span className="text-term-green">↗ forwarded · </span>}
            <span className="text-term-text">{item.from}</span>
            {" · "}
            {timeAgo(new Date(item.date * 1000).toISOString())}
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="font-mono text-[10px] uppercase tracking-wider text-term-dim transition hover:text-red-300"
          title="Dismiss (kept locally, won't reappear)"
        >
          dismiss
        </button>
      </header>

      <div className="px-4 py-3">
        <pre className="whitespace-pre-wrap break-words font-mono text-[12.5px] text-term-text">
          {item.text}
        </pre>
      </div>

      {draft ? (
        <FileForm
          draft={draft}
          onCancel={onCancelEditing}
          onChange={onDraftChange}
          onSubmit={onFile}
        />
      ) : (
        <div className="border-t border-term-border px-4 py-2.5">
          <button
            type="button"
            onClick={onStartEditing}
            className="border border-term-green/60 bg-term-green/10 px-3 py-1 font-mono text-[10.5px] uppercase tracking-wider text-term-green transition hover:bg-term-green/20"
          >
            file as issue
          </button>
        </div>
      )}
    </article>
  );
}

function FileForm({
  draft,
  onCancel,
  onChange,
  onSubmit,
}: {
  draft: Draft;
  onCancel: () => void;
  onChange: (patch: Partial<Draft>) => void;
  onSubmit: () => void;
}) {
  if (draft.result?.kind === "ok") {
    return (
      <div className="border-t border-term-border bg-term-green/5 px-4 py-3">
        <p className="font-mono text-[11.5px] text-term-green">
          ✓ filed as{" "}
          <a
            href={draft.result.htmlUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-term-green-bright"
          >
            {draft.result.repo}#{draft.result.number}
          </a>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5 border-t border-term-border bg-term-elevated/40 p-3">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-term-dim">
          repo
        </span>
        <select
          value={draft.repo}
          onChange={(e) => onChange({ repo: e.target.value as Repo })}
          className="border border-term-border bg-term-elevated px-2 py-1 font-mono text-[12px] text-term-text focus:border-term-green focus:outline-none"
        >
          {REPOS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>

      <div>
        <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.2em] text-term-dim">
          title
        </span>
        <input
          type="text"
          value={draft.title}
          onChange={(e) => onChange({ title: e.target.value })}
          className="w-full border border-term-border bg-term-elevated px-2.5 py-1.5 font-mono text-[12.5px] text-term-text focus:border-term-green focus:outline-none"
        />
      </div>

      <div>
        <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.2em] text-term-dim">
          body
        </span>
        <textarea
          value={draft.body}
          onChange={(e) => onChange({ body: e.target.value })}
          rows={4}
          className="w-full resize-y border border-term-border bg-term-elevated px-2.5 py-1.5 font-mono text-[12.5px] text-term-text focus:border-term-green focus:outline-none"
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="border border-term-border bg-transparent px-3 py-1 font-mono text-[10.5px] uppercase tracking-wider text-term-dim transition hover:text-term-text"
        >
          cancel
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={draft.submitting || !draft.title.trim()}
          className={
            draft.submitting
              ? "animate-pulse border border-amber-400/60 bg-amber-400/15 px-3 py-1 font-mono text-[10.5px] uppercase tracking-wider text-amber-300"
              : draft.result?.kind === "err"
                ? "border border-red-400/70 bg-red-500/15 px-3 py-1 font-mono text-[10.5px] uppercase tracking-wider text-red-300 hover:bg-red-500/25"
                : "border border-term-green/60 bg-term-green/10 px-3 py-1 font-mono text-[10.5px] uppercase tracking-wider text-term-green transition hover:bg-term-green/20 disabled:cursor-not-allowed disabled:border-term-border disabled:bg-transparent disabled:text-term-dim"
          }
        >
          {draft.submitting
            ? "filing…"
            : draft.result?.kind === "err"
              ? "retry"
              : "create issue"}
        </button>
      </div>

      {draft.result?.kind === "err" && (
        <p className="truncate font-mono text-[10.5px] text-red-300" title={draft.result.text}>
          × {draft.result.text}
        </p>
      )}
    </div>
  );
}
