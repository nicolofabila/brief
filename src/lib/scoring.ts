import { briefConfig } from "../../config/brief.config";
import { journalTierFromName } from "./journal-tier";

export type ScoredArticle = {
  pmid: string;
  title: string;
  abstract: string;
  journal: string;
  pubDate: string | null;
  authorsLine: string | null;
  doi: string | null;
  pubYear: number | null;
  publicationTypes: string[];
  relevanceRaw: number;
  relevanceNorm: number;
  journal_tier: number;
  early_attention: number;
  new_score: number;
  isNew: boolean;
};

const { scoring, newWithinDays } = briefConfig;

function clamp01(n: number): number {
  if (Number.isNaN(n) || !Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

export function articleMatchesAllKeywords(title: string, abstract: string, keywords: string[]): boolean {
  if (keywords.length === 0) return true;
  const h = `${title} ${abstract}`;
  return keywords.every((kw) => countPhraseHits(h, kw) > 0);
}

function countPhraseHits(haystack: string, phrase: string): number {
  const h = haystack.toLowerCase();
  const p = phrase.trim().toLowerCase();
  if (!p || p.length < 2) return 0;
  const words = p.split(/\s+/).filter((w) => w.length > 0);
  if (words.length <= 1) {
    const re = new RegExp(`\\b${escapeRegExp(p)}\\b`, "gi");
    return (h.match(re) || []).length;
  }
  const esc = p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  const re = new RegExp(esc, "gi");
  return (h.match(re) || []).length;
}

function keywordPhraseScore(title: string, abstract: string, keywords: string[], titleWeight: number): number {
  let n = 0;
  for (const kw of keywords) {
    const k = kw.trim();
    if (k.length < 2) continue;
    n += countPhraseHits(title, k) * titleWeight;
    n += countPhraseHits(abstract, k);
  }
  return n;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parsePubDateToAgeDays(pubDate: string | null, pubYear: number | null): number {
  if (pubDate) {
    const tryParse = Date.parse(pubDate);
    if (!Number.isNaN(tryParse)) {
      const diff = Date.now() - tryParse;
      return Math.max(0, diff / (1000 * 60 * 60 * 24));
    }
    const ymd = pubDate.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
    if (ymd) {
      const d = Date.UTC(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
      return Math.max(0, (Date.now() - d) / (1000 * 60 * 60 * 24));
    }
  }
  if (pubYear) {
    const july1 = Date.UTC(pubYear, 6, 1);
    return Math.max(0, (Date.now() - july1) / (1000 * 60 * 60 * 24));
  }
  return 365;
}

export function scoreArticles(
  articles: Omit<
    ScoredArticle,
    | "relevanceRaw"
    | "relevanceNorm"
    | "journal_tier"
    | "early_attention"
    | "new_score"
    | "isNew"
  >[],
  keywords: string[],
): ScoredArticle[] {
  const cap = scoring.relevanceSoftCap;
  const tw = scoring.titleHitMultiplier;
  const wr = scoring.rankRelevanceWeight;
  const wj = scoring.rankJournalWeight;
  const we = scoring.rankEarlyAttentionWeight;

  const scored: ScoredArticle[] = articles.map((a) => {
    const relevanceRaw = Math.min(cap, keywordPhraseScore(a.title, a.abstract, keywords, tw));
    const relevanceNorm = clamp01(cap > 0 ? relevanceRaw / cap : 0);

    const ageDays = parsePubDateToAgeDays(a.pubDate, a.pubYear);
    const early_attention = clamp01(Math.exp(-scoring.recencyLambdaPerDay * ageDays));

    const journal_tier = clamp01(journalTierFromName(a.journal));

    const new_score = clamp01(wr * relevanceNorm + wj * journal_tier + we * early_attention);

    const isNew = ageDays <= newWithinDays;

    return {
      ...a,
      relevanceRaw,
      relevanceNorm,
      journal_tier,
      early_attention,
      new_score,
      isNew,
    };
  });

  scored.sort((a, b) => b.new_score - a.new_score);
  return scored;
}
