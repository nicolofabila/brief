import { NextRequest, NextResponse } from "next/server";
import { efetchPubmed } from "@/lib/pubmed";

export const dynamic = "force-dynamic";

type Body = {
  pmids?: unknown;
};

export async function POST(req: NextRequest) {
  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const pmids = Array.isArray(body.pmids)
    ? body.pmids.map((x) => String(x).trim()).filter(Boolean)
    : [];

  if (pmids.length === 0) {
    return NextResponse.json({ items: [] });
  }

  try {
    const articles = await efetchPubmed(pmids);
    const items = articles.map((a) => ({
      pmid: a.pmid,
      publicationTypes: a.publicationTypes ?? [],
    }));
    return NextResponse.json({ items });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to fetch publication types";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
