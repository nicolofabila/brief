/** In-tab session: cleared when the browser data for this origin is cleared. */
const KEY = "brief_feed_dismissed_pmids_v1";

export function readSessionDismissedPmids(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.map(String));
  } catch {
    return new Set();
  }
}

export function addSessionDismissedPmid(pmid: string) {
  const s = readSessionDismissedPmids();
  s.add(pmid);
  localStorage.setItem(KEY, JSON.stringify([...s]));
}

export function removeSessionDismissedPmid(pmid: string) {
  const s = readSessionDismissedPmids();
  s.delete(pmid);
  localStorage.setItem(KEY, JSON.stringify([...s]));
}

export function clearSessionDismissedPmids() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}
