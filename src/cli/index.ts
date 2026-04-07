import { closePool } from '../db/pool';
import { logger } from '../lib/logger';
import { importKaikki } from './import-kaikki';
import { showStats } from './stats';
import { reindex } from './reindex';

const [command, ...args] = process.argv.slice(2);

async function main(): Promise<void> {
  switch (command) {
    case 'import': {
      const fileIdx = args.indexOf('--file');
      const filePath = fileIdx !== -1 ? args[fileIdx + 1] : args[0];

      if (!filePath) {
        console.error('Usage: npm run cli import -- --file <path>');
        process.exit(1);
      }

      await importKaikki(filePath);
      break;
    }

    case 'stats':
      await showStats();
      break;

    case 'reindex':
      await reindex();
      break;

    default:
      console.error(`Unknown command: ${command}`);
      console.error('Available commands: import, stats, reindex');
      process.exit(1);
  }
}

main()
  .catch((err) => {
    logger.error({ err }, 'CLI command failed');
    process.exit(1);
  })
  .finally(() => closePool());
