/**
 * Single place to tune PubMed endpoints, request limits, and ranking weights.
 * Import from server code only (do not import into client components).
 */

export const briefConfig = {
  pubmed: {
    /** Base for all E-utilities (no trailing slash). */
    baseUrl: "https://eutils.ncbi.nlm.nih.gov/entrez/eutils",
    /** Seconds to wait for upstream PubMed. */
    fetchTimeoutMs: 25_000,
    /** Max PMIDs to pull from ESearch before EFetch. */
    esearchRetmax: 120,
    /** Chunk size for EFetch id lists. */
    efetchBatchSize: 80,
    /** Extra Entrez term appended to bias toward citable articles with text. */
    defaultExtraTerm: "hasabstract[filter]",
    /** Date field for mindate/maxdate (publication date). */
    dateType: "pdat" as const,
    /** Sort order for ESearch. */
    esearchSort: "relevance" as const,
    /** When EFetch XML has no journal name, call ESummary for `fulljournalname` / `source`. */
    esummaryJournalFallback: true,
    /** Max IDs per ESummary request. */
    esummaryBatchSize: 200,
  },

  /** Default window when the client does not specify days (7 | 30 | 90). */
  defaultFeedDays: 30 as 7 | 30 | 90,

  /** How many ranked items to return from /api/feed. */
  feedLimit: 40,

  scoring: {
    /** Final rank: 0.4×relevance + 0.3×journal_tier + 0.3×early_attention (see scoring.ts). */
    rankRelevanceWeight: 0.4,
    rankJournalWeight: 0.3,
    rankEarlyAttentionWeight: 0.3,
    /** Exponential decay for early_attention from publication age: exp(-lambda * ageDays). */
    recencyLambdaPerDay: 0.12,
    /** Title keyword hits count this many times vs abstract (integer-ish multiplier). */
    titleHitMultiplier: 2,
    /** Cap raw relevance counts before normalization (stability). */
    relevanceSoftCap: 24,
  },

  /** “New” badge if paper is within this many days of today. */
  newWithinDays: 7,
} as const;

export type BriefConfig = typeof briefConfig;
