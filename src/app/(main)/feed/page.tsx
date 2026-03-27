"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { ArticleCard } from "@/components/ArticleCard";
import { FeedSwipeStack } from "@/components/FeedSwipeStack";
import { STORAGE_INTERESTS, type StoredInterests } from "@/lib/brief-storage";
import {
  addSessionDismissedPmid,
  readSessionDismissedPmids,
  removeSessionDismissedPmid,
} from "@/lib/feed-session-dismissed";
import { getSessionId } from "@/lib/session";
import { addLocalSaved, getLocalSaved, removeLocalSaved, type LocalSaved } from "@/lib/local-saved";
import { withBasePath } from "@/lib/basePath";
import type { FeedPaper } from "@/types/paper";
import { useRouter } from "next/navigation";

type Filter = "all" | "new7" | "month30" | "months3" | "trials" | "reviews";

export default function FeedPage() {
  const router = useRouter();
  const [interests, setInterests] = useState<StoredInterests | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [papers, setPapers] = useState<FeedPaper[]>([]);
  const [queue, setQueue] = useState<FeedPaper[]>([]);
  /** Length of `queue` right after each successful fetch (denominator for “n / total”). */
  const [sessionQueueTotal, setSessionQueueTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [keptPmids, setKeptPmids] = useState<Set<string>>(new Set());

  type LastAction =
    | { kind: "keep"; paper: FeedPaper; wasKeptBefore: boolean }
    | { kind: "discard"; paper: FeedPaper };
  const [lastAction, setLastAction] = useState<LastAction | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_INTERESTS);
      if (!raw) {
        router.replace("/onboarding");
        return;
      }
      const parsed = JSON.parse(raw) as StoredInterests & { topicIds?: string[] };
      const keywords = parsed.keywords ?? [];
      if (keywords.length === 0) {
        router.replace("/onboarding");
        return;
      }
      setInterests({ keywords });
    } catch {
      router.replace("/onboarding");
    }
  }, [router]);

  const trialsOnly = filter === "trials";
  const reviewsOnly = filter === "reviews";
  const effectiveDays: 7 | 30 | 90 =
    filter === "new7" ? 7 : filter === "months3" ? 90 : 30;

  const loadKeptIds = useCallback(async () => {
    const local = getLocalSaved().map((x) => x.pmid);
    const sid = getSessionId();
    let api: string[] = [];
    try {
      const r = await fetch(withBasePath(`/api/saved?sessionId=${encodeURIComponent(sid)}`));
      if (r.ok) {
        const j = (await r.json()) as { saved?: { pmid: string }[] };
        api = (j.saved ?? []).map((x) => x.pmid);
      }
    } catch {}
    setKeptPmids(new Set([...local, ...api]));
  }, []);

  useEffect(() => {
    void loadKeptIds();
  }, [loadKeptIds]);

  const fetchFeed = useCallback(async () => {
    if (!interests) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(withBasePath("/api/feed"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keywords: interests.keywords,
          days: effectiveDays,
          trialsOnly,
          reviewsOnly,
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        setError(typeof j.error === "string" ? j.error : "Could not load feed");
        setPapers([]);
        setQueue([]);
        setSessionQueueTotal(0);
        return;
      }
      const list = (j.papers ?? []) as FeedPaper[];
      setPapers(list);
      const dismissed = readSessionDismissedPmids();
      const filtered = list.filter((p) => !dismissed.has(p.pmid));
      setQueue(filtered);
      setSessionQueueTotal(filtered.length);
    } catch {
      setError("Network error");
      setPapers([]);
      setQueue([]);
      setSessionQueueTotal(0);
    } finally {
      setLoading(false);
    }
  }, [interests, effectiveDays, trialsOnly, reviewsOnly]);

  useEffect(() => {
    void fetchFeed();
  }, [fetchFeed]);

  const keepPaperIfNeeded = useCallback(
    async (paper: FeedPaper) => {
      if (keptPmids.has(paper.pmid)) return;
      const sid = getSessionId();
      const payload: LocalSaved = {
        pmid: paper.pmid,
        title: paper.title,
        abstract: paper.abstract,
        journal: paper.journal,
        pubDate: paper.pubDate,
      };
      addLocalSaved(payload);
      setKeptPmids((prev) => new Set(prev).add(paper.pmid));
      try {
        await fetch(withBasePath("/api/saved"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: sid,
            pmid: paper.pmid,
            title: paper.title,
            journal: paper.journal,
            pubDate: paper.pubDate,
            abstract: paper.abstract,
          }),
        });
      } catch {}
    },
    [keptPmids],
  );

  const onKeep = useCallback(
    async (paper: FeedPaper) => {
      const wasKeptBefore = keptPmids.has(paper.pmid);
      if (!wasKeptBefore) await keepPaperIfNeeded(paper);
      setLastAction({ kind: "keep", paper, wasKeptBefore });
      setQueue((q) => {
        if (q[0]?.pmid !== paper.pmid) return q;
        return q.slice(1);
      });
    },
    [keptPmids, keepPaperIfNeeded],
  );

  const onDiscard = useCallback((paper: FeedPaper) => {
    addSessionDismissedPmid(paper.pmid);
    setLastAction({ kind: "discard", paper });
    setQueue((q) => {
      if (q[0]?.pmid !== paper.pmid) return q;
      return q.slice(1);
    });
  }, []);

  const undoLast = useCallback(async () => {
    if (!lastAction) return;
    const sid = getSessionId();

    if (lastAction.kind === "keep") {
      const { paper, wasKeptBefore } = lastAction;
      if (!wasKeptBefore) {
        removeLocalSaved(paper.pmid);
        setKeptPmids((prev) => {
          const n = new Set(prev);
          n.delete(paper.pmid);
          return n;
        });
        try {
          await fetch(
            withBasePath(
              `/api/saved?sessionId=${encodeURIComponent(sid)}&pmid=${encodeURIComponent(paper.pmid)}`,
            ),
            { method: "DELETE" },
          );
        } catch {}
      }
    } else {
      removeSessionDismissedPmid(lastAction.paper.pmid);
    }

    setQueue((q) => {
      if (q.some((p) => p.pmid === lastAction.paper.pmid)) return q;
      return [lastAction.paper, ...q];
    });

    setLastAction(null);
  }, [lastAction]);

  const chips = useMemo(
    () =>
      [
        { id: "all" as const, label: "All" },
        { id: "new7" as const, label: "Last 7 days" },
        { id: "month30" as const, label: "Last 30 days" },
        { id: "months3" as const, label: "Last 3 months" },
        { id: "trials" as const, label: "Trials" },
        { id: "reviews" as const, label: "Reviews" },
      ] as const,
    [],
  );

  const showEmptyNoMatch = !loading && !error && papers.length === 0;
  const showQueueDone =
    !loading && !error && papers.length > 0 && queue.length === 0;
  const showSwipeStack =
    !loading && !error && papers.length > 0 && queue.length > 0;

  return (
    <div className="min-h-[100dvh] bg-surface-container-low">
      <AppHeader variant="brand" />

      <main className="mx-auto flex max-w-3xl flex-col px-4 pb-8 pt-6">
        {lastAction ? (
          <div className="fixed bottom-20 left-0 right-0 z-50 flex justify-center px-4">
            <button
              type="button"
              onClick={() => void undoLast()}
              className="rounded-full bg-surface-container-highest px-5 py-3 font-label text-sm font-bold uppercase tracking-wider text-on-surface transition-opacity hover:opacity-90 active:scale-95 shadow-sm"
            >
              Undo
            </button>
          </div>
        ) : null}

        <section className="mb-6 overflow-x-auto no-scrollbar">
          <div className="flex gap-2 pb-1">
            {chips.map((c) => {
              const active = filter === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setFilter(c.id)}
                  className={`whitespace-nowrap rounded-full px-5 py-2 font-label text-sm font-semibold transition-all active:scale-95 ${
                    active
                      ? "bg-primary text-on-primary"
                      : "bg-surface-container-highest text-on-surface-variant hover:bg-surface-variant"
                  }`}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        </section>

        {loading ? (
          <div
            className="flex min-h-[min(60dvh,480px)] flex-col items-center justify-center gap-4"
            aria-busy
            aria-label="Loading feed"
          >
            <div
              className="h-11 w-11 animate-spin rounded-full border-2 border-primary border-t-transparent"
              role="presentation"
            />
            <p className="text-center text-sm text-secondary">Fetching PubMed…</p>
          </div>
        ) : null}

        {error ? (
          <div className="rounded-xl border border-error-container bg-error-container/30 p-4 text-sm text-on-error-container">
            {error}
          </div>
        ) : null}

        {showEmptyNoMatch ? (
          <p className="text-center text-secondary">
            No papers matched this window. Try broader keywords or a longer time range.
          </p>
        ) : null}

        {showQueueDone ? (
          <div className="flex min-h-[40dvh] flex-col items-center justify-center gap-4 text-center">
            <p className="font-headline text-lg font-semibold text-on-surface">
              You&apos;re done — no more papers in this queue.
            </p>
            <p className="max-w-sm text-sm text-secondary">
              Change a filter above or refresh to load another batch from PubMed.
            </p>
            <button
              type="button"
              onClick={() => void fetchFeed()}
              className="rounded-full bg-primary px-6 py-3 font-label text-sm font-bold uppercase tracking-wider text-on-primary transition-opacity hover:opacity-90 active:scale-95"
            >
              Refresh feed
            </button>
          </div>
        ) : null}

        {showSwipeStack ? (
          <FeedSwipeStack
            queue={queue}
            totalForProgress={sessionQueueTotal}
            onKeep={onKeep}
            onDiscard={onDiscard}
            renderCard={(p) => (
              <ArticleCard
                paper={p}
                layout="feed"
              />
            )}
          />
        ) : null}
      </main>
    </div>
  );
}
