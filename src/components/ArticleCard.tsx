"use client";

import type { FeedPaper } from "@/types/paper";

function pubmedUrl(pmid: string) {
  return `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`;
}

type Props = {
  paper: FeedPaper;
  /** Feed swipe mode: links only on title + CTA so horizontal drag is not blocked. */
  layout?: "default" | "feed";
};

export function ArticleCard({ paper, layout = "default" }: Props) {
  const pubLabel = paper.pubDate ?? (paper.pubYear ? String(paper.pubYear) : "—");
  const noAbstract = "No abstract available in PubMed for this record.";
  const abstractDisplay =
    layout === "feed"
      ? paper.abstract || noAbstract
      : paper.abstract
        ? paper.abstract.length > 220
          ? `${paper.abstract.slice(0, 220)}…`
          : paper.abstract
        : noAbstract;

  const external = pubmedUrl(paper.pmid);
  const linkClass =
    "block transition-colors hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

  const titleClass =
    "mb-4 font-headline text-2xl font-bold leading-tight text-on-surface transition-colors group-hover:text-primary";

  const titleInner = (
    <h1 className={titleClass}>{paper.title || `PubMed ${paper.pmid}`}</h1>
  );

  const metaBlock = (
    <div className="space-y-2 text-sm">
      <div className="flex items-center gap-2 font-medium text-primary">
        <span className="material-symbols-outlined text-lg">menu_book</span>
        <span>{paper.journal || "Journal not listed"}</span>
      </div>
      {paper.authorsLine ? (
        <p className="text-secondary">
          <span className="font-semibold text-on-surface">Authors:</span> {paper.authorsLine}
        </p>
      ) : null}
      <p className="text-xs text-secondary">
        Published: {pubLabel} · PubMed PMID {paper.pmid}
      </p>
    </div>
  );

  const doiBlock =
    paper.doi ? (
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-secondary">
        DOI: {paper.doi}
      </p>
    ) : null;

  const abstractHeader = (
    <div className="mb-4 flex items-center gap-2">
      <span className="h-6 w-1 rounded-full bg-tertiary" />
      <h2 className="font-headline text-xl font-semibold text-on-surface">Abstract</h2>
    </div>
  );

  const abstractBodyFeed =
    paper.abstract && layout === "feed" ? (
      <div className="space-y-4 text-base leading-relaxed text-on-surface">
        {paper.abstract.split(/\n+/).map((para, i) => (
          <p key={i} className="whitespace-pre-wrap">
            {para}
          </p>
        ))}
      </div>
    ) : (
      <p
        className={`text-base leading-relaxed text-on-surface ${
          layout === "feed" ? "whitespace-pre-wrap" : "line-clamp-3 text-sm text-on-surface-variant"
        }`}
      >
        {abstractDisplay}
      </p>
    );

  const abstractSection = (
    <section className="rounded-lg bg-surface-container-low p-4 sm:p-6">
      {abstractHeader}
      {abstractBodyFeed}
    </section>
  );

  const ctaBlock = (
    <div className="mt-6 flex justify-end">
      <span className="flex items-center gap-2 font-label text-xs font-bold uppercase tracking-widest text-primary group-hover:underline">
        Open in PubMed
        <span className="material-symbols-outlined text-sm">open_in_new</span>
      </span>
    </div>
  );

  const body =
    layout === "feed" ? (
      <>
        <section className="mb-6">
          {doiBlock}
          <a href={external} target="_blank" rel="noopener noreferrer" className={linkClass}>
            {titleInner}
          </a>
          {metaBlock}
        </section>
        {abstractSection}
        <a href={external} target="_blank" rel="noopener noreferrer" className={`mt-6 ${linkClass}`}>
          {ctaBlock}
        </a>
      </>
    ) : (
      <a href={external} target="_blank" rel="noopener noreferrer" className={linkClass}>
        <section className="mb-6">
          {doiBlock}
          {titleInner}
          {metaBlock}
        </section>
        {abstractSection}
        {ctaBlock}
      </a>
    );

  return (
    <article className="group relative isolate overflow-hidden rounded-lg border border-outline-variant/15 bg-clip-padding bg-surface-container-lowest p-6 shadow-md">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {paper.isNew ? (
            <span className="rounded-full bg-tertiary-container px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-on-tertiary-container">
              New
            </span>
          ) : null}
        </div>
        <div className="flex gap-1">
          <a
            href={external}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full p-2 text-outline transition-colors hover:text-primary"
            aria-label="Open in PubMed"
          >
            <span className="material-symbols-outlined">open_in_new</span>
          </a>
        </div>
      </div>

      {body}
    </article>
  );
}
