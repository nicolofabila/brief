import { XMLParser } from "fast-xml-parser";
import { briefConfig } from "../../config/brief.config";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  isArray: (name) => name === "PubmedArticle" || name === "AbstractText" || name === "Author",
});

export type ParsedArticle = {
  pmid: string;
  title: string;
  abstract: string;
  journal: string;
  pubDate: string | null;
  authorsLine: string | null;
  doi: string | null;
  pubYear: number | null;
  publicationTypes: string[];
};

function apiKeyParam(): string {
  const k = process.env.NCBI_API_KEY;
  return k ? `&api_key=${encodeURIComponent(k)}` : "";
}

function pubmedUrl(path: string): string {
  const base = briefConfig.pubmed.baseUrl.replace(/\/$/, "");
  return `${base}/${path}`;
}

async function fetchText(url: string): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), briefConfig.pubmed.fetchTimeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, next: { revalidate: 0 } });
    if (!res.ok) throw new Error(`PubMed HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

export type EsearchResult = { pmids: string[]; count: number };

export async function esearchPubmed(params: {
  term: string;
  mindate: string;
  maxdate: string;
  retmax: number;
}): Promise<EsearchResult> {
  const { term, mindate, maxdate, retmax } = params;
  const q = new URLSearchParams({
    db: "pubmed",
    term,
    retmode: "json",
    retmax: String(retmax),
    sort: briefConfig.pubmed.esearchSort,
    datetype: briefConfig.pubmed.dateType,
    mindate,
    maxdate,
  });
  const url = `${pubmedUrl("esearch.fcgi")}?${q.toString()}${apiKeyParam()}`;
  const json = JSON.parse(await fetchText(url)) as {
    esearchresult?: { idlist?: string[]; count?: string };
  };
  const er = json.esearchresult;
  const pmids = er?.idlist ?? [];
  const count = Number(er?.count ?? pmids.length);
  return { pmids, count };
}

function normalizeList<T>(v: T | T[] | undefined): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

/** Named refs sometimes appear in PubMed text; others fall through unchanged. */
const XML_NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: "\u00a0",
};

/**
 * PubMed XML can leave numeric refs as literal text (e.g. "&#x202f;"). Decode them and
 * use normal spaces so UI shows "(n = 113)" instead of "(n&#x202f;=&#x202f;113)".
 */
export function sanitizePubMedDisplayText(s: string): string {
  if (!s) return s;
  const entityRe = /&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z][a-zA-Z0-9]*);/g;
  const decodePass = (input: string) =>
    input.replace(entityRe, (full, code: string) => {
      if (code[0] === "#") {
        const cp =
          code[1] === "x" || code[1] === "X"
            ? parseInt(code.slice(2), 16)
            : parseInt(code.slice(1), 10);
        if (!Number.isFinite(cp) || cp < 0 || cp > 0x10ffff) return full;
        try {
          return String.fromCodePoint(cp);
        } catch {
          return full;
        }
      }
      const named = XML_NAMED_ENTITIES[code.toLowerCase()];
      return named ?? full;
    });

  let t = s;
  for (let i = 0; i < 3; i++) {
    const next = decodePass(t);
    if (next === t) break;
    t = next;
  }
  t = t.replace(/\u202f/g, " ").replace(/\u00a0/g, " ");
  return t;
}

function extractAbstractText(abstractNode: unknown): string {
  if (abstractNode == null) return "";
  if (typeof abstractNode === "string") return abstractNode.trim();
  if (typeof abstractNode === "object" && abstractNode !== null && "#text" in abstractNode) {
    return String((abstractNode as { "#text": string })["#text"]).trim();
  }
  const o = abstractNode as { AbstractText?: unknown };
  const parts = normalizeList(o.AbstractText);
  return parts
    .map((p) => {
      if (typeof p === "string") return p;
      if (p && typeof p === "object" && "#text" in p) return String((p as { "#text": string })["#text"]);
      return "";
    })
    .filter(Boolean)
    .join(" ")
    .trim();
}

function extractAuthors(article: Record<string, unknown>): string | null {
  const al = article.AuthorList as { Author?: unknown } | undefined;
  const authors = normalizeList(al?.Author);
  const names = authors
    .map((a) => {
      if (!a || typeof a !== "object") return "";
      const o = a as { LastName?: string; ForeName?: string; Initials?: string };
      const ln = o.LastName ?? "";
      const initials = o.Initials ?? (o.ForeName ? o.ForeName[0] + "." : "");
      return [ln, initials].filter(Boolean).join(" ");
    })
    .filter(Boolean);
  if (names.length === 0) return null;
  if (names.length <= 3) return names.join(", ");
  return `${names[0]}, ${names[1]}, et al.`;
}

function xmlText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (Array.isArray(v)) return v.map(xmlText).filter(Boolean).join(" ").trim();
  if (typeof v === "object" && "#text" in v) return String((v as { "#text": unknown })["#text"]).trim();
  return "";
}

/** PubMed sometimes repeats nodes; take the first Article block. */
function firstArticle(medline: Record<string, unknown>): Record<string, unknown> | undefined {
  const raw = medline.Article;
  if (raw == null) return undefined;
  if (Array.isArray(raw)) {
    const first = raw[0];
    return first && typeof first === "object" ? (first as Record<string, unknown>) : undefined;
  }
  return typeof raw === "object" ? (raw as Record<string, unknown>) : undefined;
}

/** Journal lives under Article.Journal; MedlineJournalInfo is a reliable fallback. */
function extractJournal(article: Record<string, unknown> | undefined, mc: Record<string, unknown>): string {
  const journal = article?.Journal as Record<string, unknown> | undefined;
  if (journal) {
    const title = xmlText(journal.Title);
    if (title) return title;
    const iso = xmlText(journal.ISOAbbreviation);
    if (iso) return iso;
  }
  const info = mc.MedlineJournalInfo as Record<string, unknown> | undefined;
  const ta = xmlText(info?.MedlineTA);
  if (ta) return ta;
  return "";
}

function extractPubYearDate(
  article: Record<string, unknown> | undefined,
): { pubDate: string | null; pubYear: number | null } {
  const journal = article?.Journal as Record<string, unknown> | undefined;
  const jd = journal?.JournalIssue as Record<string, unknown> | undefined;
  const pubDate = jd?.PubDate as Record<string, unknown> | undefined;
  if (!pubDate) return { pubDate: null, pubYear: null };
  const year = pubDate.Year;
  const medline = pubDate.MedlineDate;
  const month = pubDate.Month;
  const day = pubDate.Day;
  let y: number | null = null;
  if (typeof year === "string" || typeof year === "number") y = Number(year);
  if (typeof medline === "string") {
    const m = medline.match(/(\d{4})/);
    if (m) y = Number(m[1]);
    return { pubDate: medline, pubYear: y };
  }
  const parts = [y, month, day].filter((x) => x != null && x !== "");
  const line =
    parts.length > 0
      ? parts.join(" ")
      : null;
  return { pubDate: line, pubYear: y };
}

function extractDoi(mc: Record<string, unknown>, article: Record<string, unknown> | undefined): string | null {
  const el = article;
  const ids = el?.ELocationID as unknown;
  const list = normalizeList(ids);
  for (const id of list) {
    if (id && typeof id === "object") {
      const o = id as { "#text"?: string; "@_EIdType"?: string };
      if (o["@_EIdType"] === "doi" && o["#text"]) return o["#text"];
    }
  }
  const data = mc.PubmedData as Record<string, unknown> | undefined;
  const idList = data?.ArticleIdList as { ArticleId?: unknown } | undefined;
  const aids = normalizeList(idList?.ArticleId);
  for (const aid of aids) {
    if (aid && typeof aid === "object") {
      const o = aid as { "#text"?: string; "@_IdType"?: string };
      if (o["@_IdType"] === "doi" && o["#text"]) return o["#text"];
    }
  }
  return null;
}

function extractPublicationTypes(article: Record<string, unknown> | undefined): string[] {
  const listNode = article?.PublicationTypeList as { PublicationType?: unknown } | undefined;
  const raw = normalizeList(listNode?.PublicationType);
  const out = raw
    .map((item) => sanitizePubMedDisplayText(xmlText(item)))
    .map((s) => s.trim())
    .filter(Boolean);
  return Array.from(new Set(out));
}

export function parseEfetchXml(xml: string): ParsedArticle[] {
  const doc = parser.parse(xml) as Record<string, unknown>;
  const root = doc.PubmedArticleSet as Record<string, unknown> | undefined;
  if (!root) return [];
  const articles = normalizeList(root.PubmedArticle);
  const out: ParsedArticle[] = [];

  for (const pa of articles) {
    if (!pa || typeof pa !== "object") continue;
    const medline = (pa as { MedlineCitation?: Record<string, unknown> }).MedlineCitation;
    if (!medline) continue;
    const pmidNode = medline.PMID;
    let pmid = "";
    if (typeof pmidNode === "string" || typeof pmidNode === "number") pmid = String(pmidNode);
    else if (pmidNode && typeof pmidNode === "object" && "#text" in pmidNode) {
      pmid = String((pmidNode as { "#text": string })["#text"]);
    }
    if (!pmid) continue;

    const article = firstArticle(medline);
    const title =
      typeof article?.ArticleTitle === "string"
        ? article.ArticleTitle
        : article?.ArticleTitle && typeof article.ArticleTitle === "object" && "#text" in article.ArticleTitle
          ? String((article.ArticleTitle as { "#text": string })["#text"])
          : "";

    const abstract = extractAbstractText(article?.Abstract);

    const { pubDate, pubYear } = extractPubYearDate(article);

    const authorsLine = article ? extractAuthors(article) : null;

    out.push({
      pmid,
      title: sanitizePubMedDisplayText(title.trim()),
      abstract: sanitizePubMedDisplayText(abstract),
      journal: sanitizePubMedDisplayText(extractJournal(article, medline)),
      pubDate,
      authorsLine: authorsLine ? sanitizePubMedDisplayText(authorsLine) : null,
      doi: extractDoi(medline, article),
      pubYear,
      publicationTypes: extractPublicationTypes(article),
    });
  }

  return out;
}

/** ESummary carries full journal title when EFetch XML omits or reshapes Journal. */
async function fetchJournalNamesFromEsummary(pmids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (pmids.length === 0) return map;
  const chunk = briefConfig.pubmed.esummaryBatchSize;
  for (let i = 0; i < pmids.length; i += chunk) {
    const slice = pmids.slice(i, i + chunk);
    const q = new URLSearchParams({
      db: "pubmed",
      retmode: "json",
      id: slice.join(","),
    });
    const url = `${pubmedUrl("esummary.fcgi")}?${q.toString()}${apiKeyParam()}`;
    const json = JSON.parse(await fetchText(url)) as {
      result?: { uids?: string[]; [key: string]: unknown };
    };
    const r = json.result;
    if (!r?.uids) continue;
    for (const uid of r.uids) {
      const rec = r[uid] as { fulljournalname?: string; source?: string } | undefined;
      if (!rec) continue;
      const name = sanitizePubMedDisplayText((rec.fulljournalname || rec.source || "").trim());
      if (name) map.set(String(uid), name);
    }
  }
  return map;
}

export async function efetchPubmed(pmids: string[]): Promise<ParsedArticle[]> {
  if (pmids.length === 0) return [];
  const batch = briefConfig.pubmed.efetchBatchSize;
  const chunks: string[][] = [];
  for (let i = 0; i < pmids.length; i += batch) {
    chunks.push(pmids.slice(i, i + batch));
  }

  const all: ParsedArticle[] = [];
  for (const ids of chunks) {
    const q = new URLSearchParams({
      db: "pubmed",
      id: ids.join(","),
      retmode: "xml",
      rettype: "abstract",
    });
    const url = `${pubmedUrl("efetch.fcgi")}?${q.toString()}${apiKeyParam()}`;
    const xml = await fetchText(url);
    all.push(...parseEfetchXml(xml));
  }

  const byId = new Map(all.map((a) => [a.pmid, a]));
  const ordered = pmids.map((id) => byId.get(id)).filter(Boolean) as ParsedArticle[];

  const missingJournal = ordered.filter((a) => !a.journal?.trim()).map((a) => a.pmid);
  if (briefConfig.pubmed.esummaryJournalFallback && missingJournal.length > 0) {
    try {
      const fromSummary = await fetchJournalNamesFromEsummary(missingJournal);
      for (const a of ordered) {
        if (!a.journal?.trim()) {
          const j = fromSummary.get(a.pmid);
          if (j) a.journal = j;
        }
      }
    } catch {
      // ESummary only enriches missing journal names; EFetch XML is enough to continue.
    }
  }

  return ordered;
}

export function formatEntrezDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}

/**
 * PubMed Title/Abstract clause for a user keyword. Phrases are quoted; single tokens use [tiab].
 * Strips characters that break Entrez query parsing.
 */
export function formatKeywordForTiab(keyword: string): string | null {
  let s = keyword
    .trim()
    .replace(/[()[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (s.length < 2) return null;
  s = s.replace(/[^\p{L}\p{N}\s.\-']/gu, " ").replace(/\s+/g, " ").trim();
  if (s.length < 2) return null;
  if (s.includes(" ")) {
    const inner = s.replace(/"/g, '\\"');
    return `"${inner}"[tiab]`;
  }
  return `${s}[tiab]`;
}

export function buildFeedSearchTerm(input: {
  keywords: string[];
  trialsOnly: boolean;
  reviewsOnly: boolean;
}): string {
  const parts: string[] = [];

  const keywordClauses: string[] = [];
  for (const k of input.keywords) {
    const tiab = formatKeywordForTiab(k);
    if (tiab) keywordClauses.push(`(${tiab})`);
  }
  if (input.keywords.length > 0 && keywordClauses.length === 0) {
    for (const k of input.keywords) {
      const s = k.trim().replace(/"/g, "").slice(0, 240);
      if (s.length >= 2) keywordClauses.push(`(${s})`);
    }
  }

  if (keywordClauses.length > 0) {
    parts.push(`(${keywordClauses.join(" AND ")})`);
  } else {
    parts.push("(biomedical research)");
  }

  parts.push(briefConfig.pubmed.defaultExtraTerm);
  if (input.trialsOnly) parts.push("Clinical Trial[pt]");
  if (input.reviewsOnly) parts.push("Review[pt]");
  return parts.join(" AND ");
}
