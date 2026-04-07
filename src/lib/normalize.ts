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
