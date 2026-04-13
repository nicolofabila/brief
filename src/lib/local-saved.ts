import type { FeedPaper } from "@/types/paper";

const KEY = "brief_saved_local_v1";

export type LocalSaved = Pick<
  FeedPaper,
  "pmid" | "title" | "abstract" | "journal" | "pubDate" | "publicationTypes"
>;

function readAll(): LocalSaved[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LocalSaved[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(items: LocalSaved[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
}

export function getLocalSaved(): LocalSaved[] {
  return readAll();
}

export function isLocallySaved(pmid: string): boolean {
  return readAll().some((x) => x.pmid === pmid);
}

export function addLocalSaved(paper: LocalSaved) {
  const all = readAll().filter((x) => x.pmid !== paper.pmid);
  all.unshift(paper);
  writeAll(all);
}

/** Returns true if now saved, false if removed. */
export function toggleLocalSaved(paper: LocalSaved): boolean {
  const all = readAll();
  const i = all.findIndex((x) => x.pmid === paper.pmid);
  if (i >= 0) {
    all.splice(i, 1);
    writeAll(all);
    return false;
  }
  all.unshift(paper);
  writeAll(all);
  return true;
}

export function removeLocalSaved(pmid: string) {
  writeAll(readAll().filter((x) => x.pmid !== pmid));
}

export function clearLocalSaved() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}

export function mergeLocalSavedPublicationTypes(pmid: string, publicationTypes: string[]) {
  if (!Array.isArray(publicationTypes) || publicationTypes.length === 0) return;
  const all = readAll();
  const i = all.findIndex((x) => x.pmid === pmid);
  if (i < 0) return;
  all[i] = {
    ...all[i],
    publicationTypes: Array.from(new Set([...(all[i].publicationTypes ?? []), ...publicationTypes])),
  };
  writeAll(all);
}
