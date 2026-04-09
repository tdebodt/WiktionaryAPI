import { createHash } from 'crypto';

/**
 * Normalize a lemma for consistent lookup.
 *
 * Strategy:
 * - NFC unicode normalization (canonical decomposition + composition)
 * - Lowercase
 * - Trim whitespace
 *
 * Accents are intentionally preserved: French distinguishes words by accent
 * (e.g. "ou" vs "où"), so stripping diacritics would merge distinct lemmas.
 */
export function normalizeLemma(lemma: string): string {
  return lemma.normalize('NFC').toLowerCase().trim();
}

/**
 * Generate a stable, deterministic ID for a dictionary entry
 * from its business key (lemma_normalized, lang_code, source_edition).
 * Returns a 12-character hex string (48 bits — collision-safe for ~16M entries).
 */
export function generateEntryId(
  lemmaNormalized: string,
  langCode: string,
  sourceEdition: string,
): string {
  const key = `${lemmaNormalized}\x1F${langCode}\x1F${sourceEdition}`;
  return createHash('sha256').update(key).digest('hex').slice(0, 12);
}
