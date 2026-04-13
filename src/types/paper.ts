export type FeedPaper = {
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
  /** Keyword match strength in title/abstract, normalized to 0–1. */
  relevanceNorm: number;
  /** Tier from explicit journal-name rules, 0–1. */
  journal_tier: number;
  /** Recency from publication date only (exponential decay), 0–1. */
  early_attention: number;
  /** 0.4×relevanceNorm + 0.3×journal_tier + 0.3×early_attention */
  new_score: number;
  isNew: boolean;
};
