import { KaikkiRecord, KaikkiSense } from '../schemas/kaikki';
import { NewEntry, EntryForm } from '../models/entry';
import { normalizeLemma } from '../../lib/normalize';

export interface MappedEntry {
  entry: NewEntry;
  senses: MappedSense[];
}

export interface MappedSense {
  senseIndex: number;
  gloss: string;
  tags: string[] | null;
  topics: string[] | null;
  categories: string[] | null;
  examplesText: string[] | null;
  rawSenseJson: Record<string, unknown> | null;
}

/**
 * Map a Kaikki JSONL record to our domain model.
 *
 * Returns null if the record is unusable (no word or no valid senses).
 */
export function mapKaikkiRecord(record: KaikkiRecord): MappedEntry | null {
  const word = record.word?.trim();
  if (!word) return null;

  const senses = extractSenses(record.senses ?? []);
  if (senses.length === 0) return null;

  const rawRecord = record as unknown as Record<string, unknown>;
  const forms = extractForms(rawRecord.forms);

  const entry: NewEntry = {
    lemma: word,
    lemmaNormalized: normalizeLemma(word),
    langCode: record.lang_code,
    langName: record.lang ?? null,
    pos: record.pos ?? '',
    etymologyIndex: record.etymology_number ?? 0,
    sourceWord: record.word,
    forms,
    rawEntryJson: rawRecord,
  };

  return { entry, senses };
}

function extractSenses(kaikkiSenses: KaikkiSense[]): MappedSense[] {
  const result: MappedSense[] = [];

  for (let i = 0; i < kaikkiSenses.length; i++) {
    const ks = kaikkiSenses[i];

    // Prefer glosses, fall back to raw_glosses
    const glosses = ks.glosses ?? ks.raw_glosses ?? [];
    const gloss = glosses.join('; ').trim();

    if (!gloss) continue;

    // Topics and categories are stored as arrays of strings in Kaikki data.
    // Categories may be strings or objects with a .name field depending on edition.
    const raw = ks as Record<string, unknown>;
    const topics = extractStringArray(raw.topics);
    const categories = extractStringArray(raw.categories);

    result.push({
      senseIndex: i,
      gloss,
      tags: ks.tags?.length ? ks.tags : null,
      topics,
      categories,
      examplesText: extractExampleTexts(ks.examples),
      rawSenseJson: ks as unknown as Record<string, unknown>,
    });
  }

  return result;
}

function extractForms(value: unknown): EntryForm[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const forms: EntryForm[] = [];
  for (const item of value) {
    if (typeof item !== 'object' || item === null) continue;
    const rec = item as Record<string, unknown>;
    const form = typeof rec.form === 'string' ? rec.form.trim() : '';
    if (!form) continue;
    const tags = Array.isArray(rec.tags)
      ? rec.tags.filter((t): t is string => typeof t === 'string')
      : [];
    forms.push({ form, tags });
  }
  return forms.length > 0 ? forms : null;
}

function extractStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const strings = value
    .map((item) => (typeof item === 'string' ? item : (item as Record<string, unknown>)?.name))
    .filter((s): s is string => typeof s === 'string' && s.length > 0);
  return strings.length > 0 ? strings : null;
}

function extractExampleTexts(
  examples?: Array<{ text?: string; english?: string }>,
): string[] | null {
  if (!examples?.length) return null;

  const texts = examples
    .map((ex) => ex.text?.trim())
    .filter((t): t is string => !!t);

  return texts.length > 0 ? texts : null;
}
