# Brief

Brief is a mobile-first web app that turns PubMed into a personalized, newspaper-style feed of biomedical papers, ranked by relevance, journal tier, and recency to your research interests.

## Stack

- [Next.js](https://nextjs.org/) 14 (App Router), React, TypeScript, Tailwind CSS
- PubMed [E-utilities](https://www.ncbi.nlm.nih.gov/books/NBK25501/) for search and article data
- Optional [PostgreSQL](https://www.postgresql.org/) via [Prisma](https://www.prisma.io/) for kept papers tied to an anonymous browser session (local storage is always used as well)

## Requirements

- Node.js 18.18 or newer (see `package.json` `engines`)

## Install

```bash
npm install
```

## Environment variables

Copy [`.env.example`](./.env.example) to `.env` locally. For deployment, set the same variables in your host’s dashboard.

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | No | PostgreSQL connection string. If unset, the feed works; the kept list falls back to local storage only (the `/api/saved` routes return an error). |
| `NCBI_API_KEY` | No | NCBI API key for higher E-utilities rate limits ([request a key](https://www.ncbi.nlm.nih.gov/account/settings/)). |
| `NEXT_PUBLIC_BASE_PATH` | No | URL path prefix when the app is not served at the domain root. Use a leading slash and no trailing slash, e.g. `/my-app`. Leave unset for deployment at `/`. |

## Database (optional)

If you set `DATABASE_URL`, apply migrations against that database:

```bash
DATABASE_URL="postgresql://..." npx prisma migrate deploy
```

Prisma is configured with Linux engine binaries suitable for Vercel (`rhel-openssl-3.0.x` in [`prisma/schema.prisma`](./prisma/schema.prisma)). `postinstall` runs `prisma generate` so installs stay in sync with the schema.

## Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Build and production serve

```bash
npm run build
npm start
```

## Deploy

Use a host that runs Next.js with server-side API routes (not static file hosting only). [Vercel](https://vercel.com) is a straightforward option:

1. Push the repository to GitHub, GitLab, or Bitbucket.
2. Create a new project in Vercel and import the repo.
3. Keep the default Next.js build settings (`npm run build`, which includes `prisma generate`).
4. Add environment variables from `.env.example` as needed.
5. After the first deploy, if you use `DATABASE_URL`, run `npx prisma migrate deploy` from any machine that can reach the database.
6. Redeploy if you change environment variables.

For subpath hosting, set `NEXT_PUBLIC_BASE_PATH` at **build time** to match the URL prefix.

## Lint

```bash
npm run lint
```
