import { NextRequest, NextResponse } from "next/server";
import { briefConfig } from "../../../../config/brief.config";
import { buildFeedSearchTerm, efetchPubmed, esearchPubmed, formatEntrezDate } from "@/lib/pubmed";
import { articleMatchesAllKeywords, scoreArticles } from "@/lib/scoring";

export const dynamic = "force-dynamic";

type FeedInput = {
  keywords: string[];
  days: 7 | 30 | 90;
  trialsOnly: boolean;
  reviewsOnly: boolean;
};

function parseDays(v: unknown): 7 | 30 | 90 {
  const n = Number(v);
  if (n === 7) return 7;
  if (n === 90) return 90;
  return briefConfig.defaultFeedDays;
}

async function runFeed(input: FeedInput): Promise<NextResponse> {
  const { keywords, days, trialsOnly, reviewsOnly } = input;

  if (keywords.length === 0) {
    return NextResponse.json({ error: "Provide at least one keyword." }, { status: 400 });
  }

  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days);

  const term = buildFeedSearchTerm({
    keywords,
    trialsOnly,
    reviewsOnly,
  });

  try {
    const { pmids } = await esearchPubmed({
      term,
      mindate: formatEntrezDate(start),
      maxdate: formatEntrezDate(end),
      retmax: briefConfig.pubmed.esearchRetmax,
    });

    const parsed = await efetchPubmed(pmids.slice(0, briefConfig.pubmed.esearchRetmax));
    let scored = scoreArticles(parsed, keywords);
    scored = scored.filter((a) => articleMatchesAllKeywords(a.title, a.abstract, keywords));
    scored = scored.slice(0, briefConfig.feedLimit);

    return NextResponse.json({
      meta: {
        days,
        term,
        pmidCount: pmids.length,
        returned: scored.length,
      },
      papers: scored,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "PubMed request failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  let body: Partial<FeedInput> = {};
  try {
    body = (await req.json()) as Partial<FeedInput>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const keywords = Array.isArray(body.keywords)
    ? body.keywords.map((k) => String(k).trim()).filter(Boolean)
    : [];
  const days = parseDays(body.days);
  const trialsOnly = Boolean(body.trialsOnly);
  const reviewsOnly = Boolean(body.reviewsOnly);

  return runFeed({ keywords, days, trialsOnly, reviewsOnly });
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const keywords = sp.get("keywords")?.split(",").map((k) => k.trim()).filter(Boolean) ?? [];
  const days = parseDays(sp.get("days"));
  const trialsOnly = sp.get("trials") === "1";
  const reviewsOnly = sp.get("reviews") === "1";

  return runFeed({ keywords, days, trialsOnly, reviewsOnly });
}
