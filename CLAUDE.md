# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WiktionaryAPI is a local dictionary API backed by PostgreSQL, using data from Kaikki.org Wiktionary JSONL extracts. Tested with the Dutch (nl) Wiktionary extract (~1M entries). Two main components:

1. **CLI importer** (`src/cli/`) — streams Kaikki JSONL/JSONL.GZ files into PostgreSQL
2. **HTTP API** (`src/api/`) — Express server exposing dictionary lookup endpoints

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
- **CLI import:** `npm run cli import -- --file <path>`
- **CLI stats:** `npm run cli stats`
- **CLI reindex:** `npm run cli reindex`
- **Infra up:** `npm run infra:up` (starts PostgreSQL via Docker Compose)
- **Infra down:** `npm run infra:down`
- **Infra reset:** `npm run infra:reset` (destroys volume + restarts)

## Architecture

```
src/
├── api/         Express HTTP server
│   ├── routes/       Route definitions (health, entries, search, senses)
│   ├── controllers/  Request handling + validation
│   ├── services/     Business logic (EntryService combines repos for responses)
│   └── middleware/    Error handler, request logging (pino-http)
├── cli/         CLI commands (import-kaikki, stats, reindex)
├── db/          PostgreSQL layer
│   ├── pool.ts       pg Pool singleton
│   ├── migrate.ts    File-based SQL migration runner
│   ├── migrations/   Raw SQL migration files (001-004)
│   └── repositories/ EntryRepository, SenseRepository
├── domain/      Core types and data mapping
│   ├── models/       Entry (with EntryForm), Sense interfaces
│   ├── schemas/      Zod schemas for Kaikki JSONL validation
│   └── mappers/      Kaikki JSON → domain model mapping
└── lib/         Shared utilities (config, logger, normalize, errors, streams)
```

## Database

PostgreSQL runs via Docker Compose (`docker-compose.yml`). Default credentials: `postgres:postgres@localhost:5432/wiktionary`.

### Tables

- **entries** — one row per word+lang+pos+etymology. Unique constraint on `(lemma_normalized, lang_code, pos, etymology_index)`. `pos` is `NOT NULL DEFAULT ''` to avoid NULL uniqueness issues. Contains `forms` JSONB column with inflected forms (plural, diminutive, conjugations).
- **senses** — one row per definition, FK to entries with CASCADE delete. Contains `topics` (normalized English labels like `"architecture"`) and `categories` (original Wiktionary category names like `"Bouwkunde_in_het_Nederlands"`).
- **entry_forms** — lookup table mapping normalized inflected forms to parent entry IDs. Enables searching "huisje" and finding "huis". Populated from `entries.forms` JSONB during migration.

### Migrations

Raw SQL in `src/db/migrations/`, tracked by `schema_migrations` table, applied via `npm run migrate`:
- `001_initial.sql` — entries + senses tables + core indexes
- `002_add_topics_categories.sql` — topics/categories on senses, backfilled from raw JSON
- `003_add_forms.sql` — forms JSONB on entries, backfilled from raw JSON
- `004_entry_forms_table.sql` — form lookup table with text_pattern_ops index

### Query Patterns

Lookups and searches use a `UNION` CTE to search both `entries.lemma_normalized` and `entry_forms.form_normalized` in parallel, letting PostgreSQL use `text_pattern_ops` indexes on each branch independently. This replaced an earlier `OR ... IN (subquery)` pattern that was ~40x slower.

## Key Patterns

- **Repository pattern** for DB access — repos take Pool, return typed domain objects
- **Service layer** combines repos to build API response shapes
- **Streaming import** via Node readline + zlib — constant memory regardless of file size
- **Batched upserts** (500/tx) with `ON CONFLICT DO UPDATE` for idempotent re-imports
- **Normalization**: lowercase + trim + NFC. Accents are preserved — critical for languages that distinguish words by diacritics (e.g., French "ou" vs "où")
- **Kaikki mapper** (`src/domain/mappers/kaikki-mapper.ts`) defensively extracts fields from variable Kaikki JSON. Forms, topics, categories, and examples are all extracted here. The raw JSON is preserved in JSONB columns for traceability

## API Endpoints

- `GET /health` — health check
- `GET /entries/:lemma?lang=&pos=` — exact lookup (also matches inflected forms via entry_forms table)
- `GET /search?q=&lang=&pos=&limit=&offset=` — prefix search across lemmas and forms
- `GET /senses/:id` — single sense with parent entry

Default `lang` for `/entries` is `fr`. Pass `lang=nl` explicitly for Dutch data.

## Testing

vitest with tests in `tests/` mirroring `src/` structure. Health endpoint test uses supertest. Domain/lib tests are pure unit tests with no DB dependency.
