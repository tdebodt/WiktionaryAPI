import path from 'path';
import { closePool } from '../db/pool';
import { logger } from '../lib/logger';
import { importKaikki } from './import-kaikki';
import { showStats } from './stats';
import { reindex } from './reindex';
import { refresh } from './refresh';

const [command, ...args] = process.argv.slice(2);

function parseFlag(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : undefined;
}

function hasFlag(flag: string): boolean {
  return args.includes(flag);
}

async function main(): Promise<void> {
  switch (command) {
    case 'import': {
      const filePath = parseFlag('--file') || args[0];
      const sourceEdition = parseFlag('--edition');

      if (!filePath || !sourceEdition) {
        console.error('Usage: npm run cli import -- --file <path> --edition <lang>');
        process.exit(1);
      }

      await importKaikki(filePath, {
        sourceEdition,
        monolingualOnly: hasFlag('--monolingual'),
      });
      break;
    }

    case 'stats':
      await showStats();
      break;

    case 'reindex':
      await reindex();
      break;

    case 'refresh': {
      const dataDir = parseFlag('--data-dir') || path.resolve('data');
      const langArg = parseFlag('--lang');
      const langs = langArg ? langArg.split(',') : undefined;
      const skipDownload = hasFlag('--skip-download');
      const monolingualOnly = hasFlag('--monolingual');

      await refresh({ dataDir, langs, skipDownload, monolingualOnly });
      break;
    }

    default:
      console.error(`Unknown command: ${command}`);
      console.error('Available commands: import, stats, reindex, refresh');
      process.exit(1);
  }
}

main()
  .catch((err) => {
    logger.error({ err }, 'CLI command failed');
    process.exit(1);
  })
  .finally(() => closePool());
