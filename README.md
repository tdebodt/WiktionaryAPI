# WiktionaryAPI

A local dictionary API backed by PostgreSQL, using data from [Kaikki.org](https://kaikki.org/) Wiktionary JSONL extracts. Supports multiple languages (English, French, German, Dutch, and any other Kaikki extract).

## Stack

- TypeScript, Node.js, Express
- PostgreSQL 17
- pino (logging), zod (validation)
- vitest (testing)

## Prerequisites

- Node.js >= 18
- Docker & Docker Compose (for local PostgreSQL), or PostgreSQL >= 14 installed natively
- Kaikki JSONL extract files from [kaikki.org/dictionary/rawdata.html](https://kaikki.org/dictionary/rawdata.html)

## Local Setup

```bash
npm install
cp .env.example .env

# Start PostgreSQL via Docker
npm run infra:up

# Run database migrations
npm run migrate
```

### Infrastructure Commands

| Command              | Description                               |
|----------------------|-------------------------------------------|
| `npm run infra:up`   | Start PostgreSQL via Docker Compose       |
| `npm run infra:down` | Stop PostgreSQL                           |
| `npm run infra:reset`| Destroy volume + restart (wipes all data) |

## Environment Variables

| Variable       | Default                                                    | Description    |
|----------------|------------------------------------------------------------|----------------|
| `PORT`         | `3000`                                                     | API server port |
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/wiktionary` | PostgreSQL URL |
| `LOG_LEVEL`    | `info`                                                     | pino log level |

## Importing Data

### Single File Import

Download extracts from [kaikki.org](https://kaikki.org/dictionary/rawdata.html), then:

```bash
# Import from gzipped JSONL
npm run cli import -- --file ./data/nl-extract.jsonl.gz

# View database statistics
npm run cli stats

# Rebuild entry_forms lookup table
npm run cli reindex
```

The importer streams the file line by line, supports gzip decompression, and uses batched upserts (500 per transaction). Re-running the import on the same file is idempotent — existing entries are updated via `ON CONFLICT`.

### Full Refresh

The `refresh` command downloads the latest extracts from Kaikki.org and imports them all:

```bash
# Download + import all languages (en, fr, de, nl) + reindex
npm run cli refresh

# Refresh specific languages only
npm run cli refresh -- --lang nl,fr

# Re-import from existing local files without re-downloading
npm run cli refresh -- --skip-download

# Custom data directory (default: ./data)
npm run cli refresh -- --data-dir /path/to/data
```

Available language codes: `en`, `fr`, `de`, `nl`.

### Import Times (approximate, M3 Mac via Docker, --monolingual)

| Language | Compressed | Entries | Senses | Time   |
|----------|-----------|---------|--------|--------|
| Dutch    | 118 MB    | 638K    | 741K   | ~8 min |
| German   | 280 MB    | 975K    | 3.1M   | ~14 min|
| French   | 663 MB    | 2.1M    | 2.6M   | ~30 min|
| English  | 2.4 GB    | 1.45M   | 1.74M  | ~29 min|

## Running the API

```bash
# Development (auto-reload via tsx)
npm run dev

# With pretty-printed logs
npm run dev | npx pino-pretty

# Production
npm run build
npm start
```

## API Endpoints

### GET /health

```bash
curl http://localhost:3000/health
```

### GET /editions

List all available Wiktionary editions.

```bash
curl http://localhost:3000/editions
# { "editions": ["de", "en", "fr", "nl"] }
```

### GET /editions/:edition/languages

List all languages available in a given edition.

```bash
curl http://localhost:3000/editions/nl/languages
# { "languages": ["nl"] }
```

### GET /editions/:edition/languages/:lang/entries

Browse, search, or filter entries within an edition and language. Always returns a paginated collection with `meta` and `links`.

```bash
# Browse alphabetically (paginated)
curl "http://localhost:3000/editions/nl/languages/nl/entries?limit=20"

# Exact lookup by lemma
curl "http://localhost:3000/editions/fr/languages/fr/entries?lemma=maison"

# Prefix search
curl "http://localhost:3000/editions/nl/languages/nl/entries?q=hui&limit=10"
```

Query parameters: `lemma` (exact match), `q` (prefix search), `pos`, `limit` (max 100, default 20), `offset`.

Response:

```json
{
  "meta": { "limit": 20, "offset": 0 },
  "links": {
    "self": "http://localhost:3000/editions/nl/languages/nl/entries?limit=20&offset=0",
    "next": "http://localhost:3000/editions/nl/languages/nl/entries?limit=20&offset=20",
    "prev": null,
    "start": "http://localhost:3000/editions/nl/languages/nl/entries?limit=20"
  },
  "results": [
    {
      "href": "http://localhost:3000/editions/nl/languages/nl/entries/huis",
      "lemma": "huis",
      "langCode": "nl",
      "langName": "Nederlands",
      "sourceEdition": "nl",
      "formOf": [],
      "lexemes": [
        {
          "pos": "noun",
          "etymologyIndex": 0,
          "forms": [
            { "form": "huizen", "tags": ["plural"], "href": "http://localhost:3000/editions/nl/languages/nl/entries/huizen" }
          ],
          "senses": [
            {
              "gloss": "gebouw bestemd om in te wonen",
              "tags": [],
              "topics": ["architecture"],
              "categories": ["Bouwkunde_in_het_Nederlands"],
              "examples": ["Zij wonen in een groot huis."]
            }
          ]
        }
      ]
    }
  ]
}
```

### GET /editions/:edition/languages/:lang/entries/:lemma

Get a single dictionary entry by lemma (singleton). Includes `formOf` back-links to parent entries with `formAs` relationship tags, and `href` on each form for forward navigation.

```bash
curl "http://localhost:3000/editions/nl/languages/nl/entries/huis"
curl "http://localhost:3000/editions/nl/languages/nl/entries/huisje"
```

The `formOf` field shows parent entries this lemma is a form of:

```json
{
  "href": "http://localhost:3000/editions/nl/languages/nl/entries/huisje",
  "lemma": "huisje",
  "formOf": [
    {
      "lemma": "huis",
      "pos": "noun",
      "formAs": ["diminutive", "singular"],
      "href": "http://localhost:3000/editions/nl/languages/nl/entries/huis"
    }
  ],
  "lexemes": [...]
}
```

Append `?skos` to export as SKOS Turtle (one `skos:Concept` per sense):

```bash
curl "http://localhost:3000/editions/nl/languages/nl/entries/huis?skos"
# Content-Type: text/turtle
```

### GET /search

Cross-edition prefix search.

```bash
curl "http://localhost:3000/search?q=mais&lang=fr&limit=10"
curl "http://localhost:3000/search?q=house&edition=en&limit=5"
```

Query parameters: `q` (required), `edition`, `lang`, `pos`, `limit` (max 100), `offset`.

Returns paginated results with `meta` and `links`, same structure as the entries collection.

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

To add a new migration, create a file like `src/db/migrations/005_add_something.sql`.

## Deploying to a VPS (Linode)

### 1. Provision the Server

Create a Linode instance (recommended: Dedicated 4GB+ for the full dataset). Install dependencies:

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y nodejs npm postgresql nginx

# Or use NodeSource for a recent Node.js version
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### 2. Set Up PostgreSQL

```bash
sudo -u postgres createdb wiktionary
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'your-secure-password';"
```

For better import performance, tune PostgreSQL in `/etc/postgresql/*/main/postgresql.conf`:

```ini
shared_buffers = 1GB
work_mem = 256MB
maintenance_work_mem = 512MB
wal_buffers = 64MB
synchronous_commit = off       # safe for bulk import, re-enable after
effective_cache_size = 3GB
```

Restart PostgreSQL after changes: `sudo systemctl restart postgresql`

### 3. Transfer Data (Option A: pg_dump)

If you've already imported data locally, dump and transfer:

```bash
# On your local machine
pg_dump -h localhost -U postgres -d wiktionary -Fc -f wiktionary.dump

# Copy to Linode
scp wiktionary.dump user@your-linode-ip:~/

# On the Linode — restore (use -j for parallel restore)
pg_restore -h localhost -U postgres -d wiktionary -j 4 wiktionary.dump
```

### 3. Transfer Data (Option B: Import on Server)

Import directly on the server (faster PostgreSQL I/O since it's native, not Docker):

```bash
cd /opt/wiktionary-api
npm run migrate
npm run cli refresh
```

### 4. Deploy the Application

```bash
# Clone and build
cd /opt
git clone <your-repo-url> wiktionary-api
cd wiktionary-api
npm ci
npm run build

# Configure environment
cp .env.example .env
# Edit .env:
#   DATABASE_URL=postgresql://postgres:your-secure-password@localhost:5432/wiktionary
#   PORT=3000
#   LOG_LEVEL=info

# Run migrations
npm run migrate
```

### 5. Process Management (systemd)

Create `/etc/systemd/system/wiktionary-api.service`:

```ini
[Unit]
Description=WiktionaryAPI
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/wiktionary-api
ExecStart=/usr/bin/node dist/api/server.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
EnvironmentFile=/opt/wiktionary-api/.env

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable wiktionary-api
sudo systemctl start wiktionary-api

# Check status
sudo systemctl status wiktionary-api
sudo journalctl -u wiktionary-api -f
```

### 6. Reverse Proxy (nginx)

Create `/etc/nginx/sites-available/wiktionary-api`:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/wiktionary-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Optional: add HTTPS via Let's Encrypt
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### 7. Firewall

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### Updating Data on the Server

```bash
cd /opt/wiktionary-api
npm run cli refresh
sudo systemctl restart wiktionary-api
```

## Design Decisions

- **bigserial over UUID** — simpler, faster for joins, sufficient for a local service.
- **pos NOT NULL DEFAULT ''** — avoids NULL uniqueness issues in the composite unique constraint `(lemma_normalized, lang_code, pos, etymology_index)` used for idempotent upserts.
- **Accents preserved in normalization** — languages distinguish words by accent (e.g., French "ou" vs "ou"), so we only lowercase + NFC-normalize, not strip diacritics.
- **Prefix search via `LIKE 'x%'`** — simple, uses btree index with `text_pattern_ops`, adequate for dictionary lookup.
- **UNION CTE for form lookups** — searches both `entries.lemma_normalized` and `entry_forms.form_normalized` in parallel, ~40x faster than the `OR ... IN (subquery)` alternative.
- **Raw JSON in JSONB columns** — Kaikki records are complex. Storing originals enables future re-extraction without re-importing.
- **Streaming importer** — uses Node readline over streams (with zlib for `.gz`), constant memory regardless of file size.

## Limitations

- No semantic/vector search.
- No authentication or rate limiting.
- Search is prefix-only (no fuzzy matching).
