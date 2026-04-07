import { createReadStream } from 'fs';
import { createGunzip } from 'zlib';
import { createInterface } from 'readline';

/**
 * Create a line-by-line async iterable from a file path.
 * Handles both plain .jsonl and .jsonl.gz files via streaming.
 */
export function createJsonlReader(filePath: string): AsyncIterable<string> {
  const isGzipped = filePath.endsWith('.gz');
  let stream: NodeJS.ReadableStream = createReadStream(filePath);

  if (isGzipped) {
    stream = stream.pipe(createGunzip());
  }

  return createInterface({
    input: stream,
    crlfDelay: Infinity,
  });
}
