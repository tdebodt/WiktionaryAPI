# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WiktionaryAPI is a dictionary API backed by PostgreSQL, using data from Kaikki.org Wiktionary JSONL extracts. Supports multiple Wiktionary editions (en, fr, de, nl) with each edition kept separate — glosses are in the edition's language. Two main components:

1. **CLI importer** (`src/cli/`) — streams Kaikki JSONL/JSONL.GZ files into PostgreSQL
2. **HTTP API** (`src/api/`) — Express server exposing a resource-nested REST API

## Commands

- **Install:** `npm install`
- **Build:** `npm run build`
- **Dev server:** `npm run dev` (tsx watch, pipe through `npx pino-pretty` for readable logs)
- **Production:** `npm run build && npm start`
- **Migrations:** `npm run migrate`
- **Tests:** `npm test`
- **Single test file:** `npx vitest run tests/path/to/file.test.ts`
- **Watch tests:** `npm run test:watch`
- **Type check:** `npm run typecheck`
- **CLI import:** `npm run cli import -- --file <path> --edition <lang> [--monolingual]`
- **CLI refresh:** `npm run cli refresh [-- --lang nl,fr] [--monolingual] [--skip-download]`
- **CLI stats:** `npm run cli stats`
- **CLI reindex:** `npm run cli reindex` (rebuilds entry_forms + reindexes tables)
- **Infra up:** `npm run infra:up` (starts PostgreSQL via Docker Compose)
- **Infra down:** `npm run infra:down`
- **Infra reset:** `npm run infra:reset` (destroys volume + restarts)

## Architecture

```
src/
├── api/         Express HTTP server
│   ├── routes/       Route definitions (editions, entries, search, health)
│   ├── controllers/  Request handling + validation + href building
│   ├── services/     Business logic (EntryService groups entries into DictionaryEntry)
│   ├── serializers/  Output format serializers (SKOS Turtle)
│   └── middleware/    Error handler, request logging (pino-http)
├── cli/         CLI commands (import-kaikki, refresh, stats, reindex)
├── db/          PostgreSQL layer
│   ├── pool.ts       pg Pool singleton
│   ├── migrate.ts    File-based SQL migration runner
│   ├── migrations/   Raw SQL migration files (001-007)
│   └── repositories/ EntryRepository, SenseRepository
├── domain/      Core types and data mapping
│   ├── models/       Entry (with EntryForm), Sense interfaces
│   ├── schemas/      Zod schemas for Kaikki JSONL validation
│   └── mappers/      Kaikki JSON → domain model mapping (accepts sourceEdition)
└── lib/         Shared utilities (config, logger, normalize, errors, streams)
```

## Database

PostgreSQL runs via Docker Compose (`docker-compose.yml`). Default credentials: `postgres:postgres@localhost:5432/wiktionary`.

### Tables

- **entries** — one row per word+lang+pos+etymology+edition. Unique constraint on `(lemma_normalized, lang_code, pos, etymology_index, source_edition)`. `source_edition` tracks which Wiktionary edition the entry came from. `stable_id` is a deterministic SHA-256 hash of `(lemma_normalized, lang_code, source_edition)` — shared by all rows of the same dictionary entry. Contains `forms` JSONB column with inflected forms.
- **entries_raw** — stores raw Kaikki JSON per entry (1:1 FK to entries). Split from entries for query performance.
- **senses** — one row per definition, FK to entries with CASCADE delete. Contains `topics` (normalized English labels like `"architecture"`) and `categories` (original Wiktionary category names).
- **entry_forms** — lookup table mapping normalized inflected forms to parent entry IDs. Enables searching "huisje" and finding "huis". Rebuilt by `npm run cli reindex`.

### Migrations

Raw SQL in `src/db/migrations/`, tracked by `schema_migrations` table, applied via `npm run migrate`:
- `001_initial.sql` — entries + senses tables + core indexes
- `002_add_topics_categories.sql` — topics/categories on senses
- `003_add_forms.sql` — forms JSONB on entries
- `004_entry_forms_table.sql` — form lookup table with text_pattern_ops index
- `005_split_raw_json.sql` — moves raw JSON to entries_raw table
- `006_add_source_edition.sql` — adds source_edition column, updates unique constraint
- `007_add_stable_id.sql` — adds stable_id column for deterministic entry identification

### Query Patterns

Lookups and searches use a `UNION` CTE to search both `entries.lemma_normalized` and `entry_forms.form_normalized` in parallel, letting PostgreSQL use `text_pattern_ops` indexes on each branch independently.

## Key Patterns

- **Multi-edition**: Each Wiktionary edition (fr, nl, de, en) is imported separately with `--edition`. Entries from different editions don't overwrite each other — the French Wiktionary's definition of a Dutch word (glosses in French) coexists with the Dutch Wiktionary's own definition (glosses in Dutch).
- **Monolingual filter**: `--monolingual` flag skips entries where `lang_code !== sourceEdition`, importing only the edition's native language entries.
- **Resource-nested REST API**: `/editions/:edition/languages/:lang/entries/:lemma`. Collections return `{ meta, links, results }` with pagination (next/prev/self/start). Singletons return the entry directly.
- **Dictionary entry grouping**: DB rows (one per pos/etymology) are grouped in the API response by `(lemma, lang, edition)` into a `DictionaryEntry` with nested `lexemes`.
- **Bidirectional navigation**: Forms include `href` to their own entry. Entries include `formOf` back-links with `formAs` relationship tags (e.g., `["diminutive", "singular"]`).
- **Absolute URIs**: All `href` and pagination links are absolute, using `BASE_URL` env var or request headers (`x-forwarded-proto`, `x-forwarded-host`).
- **SKOS Turtle export**: `?skos` on singleton returns `text/turtle` with one `skos:Concept` per genuine sense (form-of senses filtered out). No fabricated relationships.
- **Repository pattern** for DB access — repos take Pool, return typed domain objects
- **Streaming import** via Node readline + zlib — constant memory regardless of file size
- **Batched upserts** (500/tx) with `ON CONFLICT DO UPDATE` for idempotent re-imports
- **Normalization**: lowercase + trim + NFC. Accents are preserved — critical for languages that distinguish words by diacritics (e.g., French "ou" vs "où")

## API Endpoints

- `GET /health` — health check
- `GET /editions` — list available editions
- `GET /editions/:edition/languages` — list languages in an edition
- `GET /editions/:edition/languages/:lang/entries` — browse (paginated), exact lookup (`?lemma=`), or prefix search (`?q=`)
- `GET /editions/:edition/languages/:lang/entries/:lemma` — singleton entry with lexemes, forms, senses, formOf links. Append `?skos` for Turtle export.
- `GET /search?q=&edition=&lang=&pos=&limit=&offset=` — cross-edition prefix search

## Testing

vitest with tests in `tests/` mirroring `src/` structure. Health endpoint test uses supertest. Domain/lib tests are pure unit tests with no DB dependency.
