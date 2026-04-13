"use client";

import { useCallback, useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { getSessionId } from "@/lib/session";
import {
  getLocalSaved,
  mergeLocalSavedPublicationTypes,
  removeLocalSaved,
  type LocalSaved,
} from "@/lib/local-saved";
import { withBasePath } from "@/lib/basePath";

type Row = LocalSaved & { id?: string };

const TAG_ORDER = [
  "Review",
  "Systematic Review",
  "Meta-Analysis",
  "Randomized Controlled Trial",
  "Clinical Trial",
  "Case Reports",
  "Practice Guideline",
  "Editorial",
] as const;

function normalizedPublicationTags(publicationTypes: string[] | null | undefined): string[] {
  const lower = (publicationTypes ?? []).map((t) => t.toLowerCase());
  const hasContains = (...needles: string[]) =>
    needles.some((needle) => lower.some((t) => t.includes(needle)));
  const tags: string[] = [];

  if (hasContains("review")) tags.push("Review");
  if (hasContains("systematic review")) tags.push("Systematic Review");
  if (hasContains("meta-analysis", "meta analysis")) tags.push("Meta-Analysis");
  if (hasContains("randomized controlled trial", "randomised controlled trial")) {
    tags.push("Randomized Controlled Trial");
  }
  if (hasContains("clinical trial")) tags.push("Clinical Trial");
  if (hasContains("case report")) tags.push("Case Reports");
  if (hasContains("practice guideline")) tags.push("Practice Guideline");
  if (hasContains("editorial")) tags.push("Editorial");

  return TAG_ORDER.filter((label) => tags.includes(label));
}

export default function KeptPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const sid = getSessionId();
    let server: Row[] = [];
    try {
      const r = await fetch(withBasePath(`/api/saved?sessionId=${encodeURIComponent(sid)}`));
      if (r.ok) {
        const j = (await r.json()) as {
          saved?: {
            id: string;
            pmid: string;
            title: string;
            journal: string | null;
            pubDate: string | null;
            abstract: string | null;
            publicationTypes?: string[] | null;
          }[];
        };
        server = (j.saved ?? []).map((s) => ({
          id: s.id,
          pmid: s.pmid,
          title: s.title,
          journal: s.journal ?? "",
          pubDate: s.pubDate,
          abstract: s.abstract ?? "",
          publicationTypes: Array.isArray(s.publicationTypes) ? s.publicationTypes : [],
        }));
      }
    } catch {}

    const local = getLocalSaved();
    const byPmid = new Map<string, Row>();
    for (const x of local) byPmid.set(x.pmid, x);
    for (const x of server) {
      const existing = byPmid.get(x.pmid);
      byPmid.set(x.pmid, {
        ...x,
        publicationTypes:
          x.publicationTypes.length > 0 ? x.publicationTypes : (existing?.publicationTypes ?? []),
      });
    }

    setRows(Array.from(byPmid.values()).sort((a, b) => a.title.localeCompare(b.title)));
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const missing = rows
      .filter((r) => (r.publicationTypes ?? []).length === 0)
      .map((r) => r.pmid);
    if (missing.length === 0) return;

    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch(withBasePath("/api/publication-types"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pmids: missing }),
        });
        if (!r.ok) return;
        const j = (await r.json()) as {
          items?: { pmid: string; publicationTypes: string[] }[];
        };
        const map = new Map(
          (j.items ?? []).map((x) => [x.pmid, Array.isArray(x.publicationTypes) ? x.publicationTypes : []]),
        );
        if (cancelled || map.size === 0) return;

        setRows((prev) =>
          prev.map((row) => {
            if ((row.publicationTypes ?? []).length > 0) return row;
            const types = map.get(row.pmid) ?? [];
            if (types.length === 0) return row;
            mergeLocalSavedPublicationTypes(row.pmid, types);
            return { ...row, publicationTypes: types };
          }),
        );
      } catch {}
    })();

    return () => {
      cancelled = true;
    };
  }, [rows]);

  const remove = async (pmid: string) => {
    removeLocalSaved(pmid);
    const sid = getSessionId();
    try {
      await fetch(
        withBasePath(`/api/saved?sessionId=${encodeURIComponent(sid)}&pmid=${encodeURIComponent(pmid)}`),
        { method: "DELETE" },
      );
    } catch {}
    setRows((prev) => prev.filter((r) => r.pmid !== pmid));
  };

  return (
    <div className="min-h-[100dvh] bg-surface-container-low">
      <AppHeader variant="brand" title="Kept" />
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-8">
        {loading ? <p className="text-secondary">Loading…</p> : null}
        {!loading && rows.length === 0 ? (
          <p className="text-secondary">
            Nothing kept yet. Swipe right (Keep) to add papers here.
          </p>
        ) : null}
        {rows.map((r) => (
          (() => {
            const tags = normalizedPublicationTags(r.publicationTypes);
            return (
          <div
            key={r.pmid}
            className="flex items-start gap-4 rounded-lg border border-outline-variant/15 bg-surface-container-lowest p-6"
          >
            <div className="min-w-0 flex-1">
              {tags.length > 0 ? (
                <div className="mb-2 flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <span
                      key={`${r.pmid}-${tag}`}
                      className="rounded-full bg-surface-variant px-3 py-1 text-[10px] font-semibold text-on-surface-variant"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
              <a
                href={`https://pubmed.ncbi.nlm.nih.gov/${r.pmid}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-headline text-base font-bold text-on-surface hover:text-primary"
              >
                {r.title}
              </a>
              <p className="mt-1 text-xs text-secondary">
                {r.journal || "—"} · PMID {r.pmid}
              </p>
            </div>
            <button
              type="button"
              onClick={() => remove(r.pmid)}
              className="shrink-0 rounded-full p-2 text-secondary hover:text-tertiary"
              aria-label="Remove"
            >
              <span className="material-symbols-outlined">delete</span>
            </button>
          </div>
            );
          })()
        ))}
      </main>
    </div>
  );
}

