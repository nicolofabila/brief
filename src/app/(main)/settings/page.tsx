"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { STORAGE_INTERESTS, type StoredInterests } from "@/lib/brief-storage";

export default function SettingsPage() {
  const router = useRouter();
  const [kwInput, setKwInput] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_INTERESTS);
      if (raw) {
        const p = JSON.parse(raw) as StoredInterests & { topicIds?: string[] };
        setKeywords(p.keywords ?? []);
      }
    } catch {}
  }, []);

  const save = () => {
    const data: StoredInterests = { keywords };
    localStorage.setItem(STORAGE_INTERESTS, JSON.stringify(data));
    router.push("/feed");
  };

  return (
    <div className="min-h-[100dvh] bg-surface-container-low">
      <AppHeader variant="brand" title="Settings" />
      <main className="mx-auto max-w-lg space-y-8 px-4 py-8">
        <p className="text-sm text-secondary">
          Keywords are stored in this browser only. With a database configured on the server, kept papers also sync for this device&apos;s session.
        </p>

        <div>
          <h2 className="mb-3 font-headline text-lg font-bold">Keywords</h2>
          <p className="mb-3 text-xs text-secondary">
            We search these in each paper&apos;s title and abstract on PubMed.
          </p>
          <div className="flex gap-2">
            <input
              value={kwInput}
              onChange={(e) => setKwInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const t = kwInput.trim();
                  if (t) {
                    setKeywords((k) => (k.includes(t) ? k : [...k, t]));
                    setKwInput("");
                  }
                }
              }}
              className="flex-1 rounded-xl border border-outline-variant/30 bg-white px-4 py-3 text-sm"
              placeholder="Add a keyword"
            />
            <button
              type="button"
              onClick={() => {
                const t = kwInput.trim();
                if (t) {
                  setKeywords((k) => (k.includes(t) ? k : [...k, t]));
                  setKwInput("");
                }
              }}
              className="rounded-xl bg-tertiary px-4 font-label text-sm font-bold text-on-tertiary"
            >
              Add
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {keywords.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKeywords((prev) => prev.filter((x) => x !== k))}
                className="rounded-full bg-surface-container-high px-3 py-1 text-xs font-semibold text-on-surface"
              >
                {k} ×
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          disabled={keywords.length === 0}
          onClick={save}
          className="w-full rounded-full bg-tertiary py-4 font-headline font-bold text-on-tertiary shadow-sm active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Save &amp; reload feed
        </button>
      </main>
    </div>
  );
}
