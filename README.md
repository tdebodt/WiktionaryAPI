# WiktionaryAPI

A local dictionary API backed by PostgreSQL, using data from [Kaikki.org](https://kaikki.org/) French Wiktionary extracts.

## Stack

- TypeScript, Node.js, Express
- PostgreSQL
- pino (logging), zod (validation)
- vitest (testing)

## Prerequisites

- Node.js >= 18
- PostgreSQL >= 14
- A Kaikki JSONL extract file (e.g., `kaikki.org-dictionary-French.jsonl.gz`)

## Setup

```bash
npm install
cp .env.example .env
# Edit .env with your database connection string

createdb wiktionary
npm run migrate
```

## Environment Variables

| Variable       | Default                                  | Description    |
|----------------|------------------------------------------|----------------|
| `PORT`         | `3000`                                   | API server port |
| `DATABASE_URL` | `postgresql://localhost:5432/wiktionary` | PostgreSQL URL |
| `LOG_LEVEL`    | `info`                                   | pino log level |

## Importing Data

Download a French Wiktionary extract from Kaikki.org, then:

```bash
# Import from gzipped JSONL
npm run cli import -- --file ./data/fr-extract.jsonl.gz

# Import from plain JSONL
npm run cli import -- --file ./data/fr-extract.jsonl

# View database statistics
npm run cli stats

# Reindex tables after large imports
npm run cli reindex
```

The importer streams the file line by line, supports gzip decompression, and uses batched upserts (500 per transaction). Re-running the import on the same file is idempotent — existing entries are updated via `ON CONFLICT`.

## Running the API

```bash
# Development (auto-reload via tsx)
npm run dev

# Production
npm run build
npm start
```

For pretty-printed logs in development:

```bash
npm run dev | npx pino-pretty
```

## API Endpoints

### GET /health

```bash
curl http://localhost:3000/health
```

### GET /entries/:lemma

Exact lookup by lemma. Returns all matching entries with their senses.

```bash
curl http://localhost:3000/entries/chat
curl "http://localhost:3000/entries/chat?lang=fr&pos=noun"
```

Response:

```json
{
  "lemma": "chat",
  "results": [
    {
      "entryId": 42,
      "lemma": "chat",
      "langCode": "fr",
      "pos": "noun",
      "senses": [
        {
          "senseId": 100,
          "senseIndex": 0,
          "gloss": "Mammifère carnivore domestique...",
          "tags": ["masculine"],
          "examples": ["Le chat dort."]
        }
      ]
    }
  ]
}
```

### GET /search

Prefix search across lemmas.

```bash
curl "http://localhost:3000/search?q=mais&lang=fr&limit=10"
```

Query parameters: `q` (required), `lang`, `pos`, `limit` (max 100), `offset`.

### GET /senses/:id

Get a single sense with its parent entry.

```bash
curl http://localhost:3000/senses/42
```

## Testing

```bash
npm test            # Run once
npm run test:watch  # Watch mode
npm run typecheck   # Type checking only
```

## Database Migrations

Migrations are plain SQL files in `src/db/migrations/`. They are tracked in a `schema_migrations` table and applied in alphabetical order.

```bash
npm run migrate
```

To add a new migration, create a file like `src/db/migrations/002_add_something.sql`.

## Design Decisions

- **bigserial over UUID** — simpler, faster for joins, sufficient for a local service.
- **pos NOT NULL DEFAULT ''** — avoids NULL uniqueness issues in the composite unique constraint `(lemma_normalized, lang_code, pos, etymology_index)` used for idempotent upserts.
- **Accents preserved in normalization** — French distinguishes words by accent (e.g., "ou" vs "où"), so we only lowercase + NFC-normalize, not strip diacritics.
- **Prefix search via `LIKE 'x%'`** — simple, uses btree index with `text_pattern_ops`, adequate for dictionary lookup.
- **Raw JSON in JSONB columns** — Kaikki records are complex. Storing originals enables future re-extraction without re-importing.
- **Streaming importer** — uses Node readline over streams (with zlib for `.gz`), constant memory regardless of file size.

## Limitations

- Single-language optimized (French by default, but any Kaikki extract works).
- No semantic/vector search.
- No authentication or rate limiting.
- Search is prefix-only (no fuzzy matching).
