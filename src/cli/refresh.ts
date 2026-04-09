import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { logger } from '../lib/logger';
import { importKaikki } from './import-kaikki';
import { reindex } from './reindex';

const DATASETS: { lang: string; url: string; filename: string }[] = [
  {
    lang: 'nl',
    url: 'https://kaikki.org/dictionary/downloads/nl/nl-extract.jsonl.gz',
    filename: 'nl-extract.jsonl.gz',
  },
  {
    lang: 'de',
    url: 'https://kaikki.org/dictionary/downloads/de/de-extract.jsonl.gz',
    filename: 'de-extract.jsonl.gz',
  },
  {
    lang: 'fr',
    url: 'https://kaikki.org/dictionary/downloads/fr/fr-extract.jsonl.gz',
    filename: 'fr-extract.jsonl.gz',
  },
  {
    lang: 'en',
    url: 'https://kaikki.org/dictionary/raw-wiktextract-data.jsonl.gz',
    filename: 'raw-wiktextract-data.jsonl.gz',
  },
];

interface RefreshOptions {
  dataDir: string;
  langs?: string[];
  skipDownload?: boolean;
  monolingualOnly?: boolean;
}

export async function refresh(options: RefreshOptions): Promise<void> {
  const { dataDir, langs, skipDownload, monolingualOnly } = options;

  const datasets = langs
    ? DATASETS.filter((d) => langs.includes(d.lang))
    : DATASETS;

  if (datasets.length === 0) {
    logger.error({ langs }, 'No matching datasets found');
    process.exit(1);
  }

  fs.mkdirSync(dataDir, { recursive: true });

  for (const dataset of datasets) {
    const filePath = path.join(dataDir, dataset.filename);

    if (!skipDownload) {
      logger.info({ lang: dataset.lang, url: dataset.url }, 'Downloading');
      execSync(`curl -L -o "${filePath}" "${dataset.url}"`, {
        stdio: 'inherit',
      });
      logger.info({ lang: dataset.lang, filePath }, 'Download complete');
    } else if (!fs.existsSync(filePath)) {
      logger.error({ filePath }, 'File not found and --skip-download is set, skipping');
      continue;
    }

    logger.info({ lang: dataset.lang, monolingualOnly }, 'Importing');
    await importKaikki(filePath, {
      sourceEdition: dataset.lang,
      monolingualOnly,
    });
  }

  logger.info('Rebuilding entry_forms index');
  await reindex();

  logger.info('Refresh complete');
}
