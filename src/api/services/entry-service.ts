import { Pool } from 'pg';
import { EntryRepository } from '../../db/repositories/entry-repository';
import { SenseRepository } from '../../db/repositories/sense-repository';
import { Entry } from '../../domain/models/entry';
import { normalizeLemma } from '../../lib/normalize';

export interface SenseResponse {
  gloss: string;
  tags: string[];
  topics: string[];
  categories: string[];
  examples: string[];
}

export interface FormResponse {
  form: string;
  tags: string[];
}

export interface LexemeResponse {
  pos: string | null;
  etymologyIndex: number;
  forms: FormResponse[];
  senses: SenseResponse[];
}

export interface FormOfLink {
  lemma: string;
  pos: string | null;
  formAs: string[];
}

export interface DictionaryEntry {
  lemma: string;
  langCode: string;
  langName: string | null;
  sourceEdition: string;
  formOf: FormOfLink[];
  lexemes: LexemeResponse[];
}

type SensesMap = Map<number, Array<{
  id: number; senseIndex: number; gloss: string;
  tags: string[] | null; topics: string[] | null;
  categories: string[] | null; examplesText: string[] | null;
}>>;

export class EntryService {
  private entryRepo: EntryRepository;
  private senseRepo: SenseRepository;

  constructor(pool: Pool) {
    this.entryRepo = new EntryRepository(pool);
    this.senseRepo = new SenseRepository(pool);
  }

  async listEditions(): Promise<string[]> {
    return this.entryRepo.listEditions();
  }

  async listLanguages(edition: string): Promise<string[]> {
    return this.entryRepo.listLanguages(edition);
  }

  async getEntries(
    edition: string,
    langCode: string,
    lemma?: string,
    q?: string,
    pos?: string,
    limit: number = 20,
    offset: number = 0,
  ): Promise<{ results: DictionaryEntry[]; hasMore: boolean }> {
    let entries: Entry[];

    if (lemma) {
      entries = await this.entryRepo.findByNormalizedLemma(lemma, langCode, pos, edition);
      return { results: await this.groupEntries(entries), hasMore: false };
    } else if (q) {
      entries = await this.entryRepo.searchByPrefix(q, langCode, pos, edition, limit + 1, offset);
    } else {
      entries = await this.entryRepo.browse(langCode, edition, limit + 1, offset);
    }

    const hasMore = entries.length > limit;
    if (hasMore) entries = entries.slice(0, limit);
    return { results: await this.groupEntries(entries), hasMore };
  }

  async getEntry(
    edition: string,
    langCode: string,
    lemma: string,
  ): Promise<DictionaryEntry | null> {
    const normalized = normalizeLemma(lemma);
    const allEntries = await this.entryRepo.findByNormalizedLemma(lemma, langCode, undefined, edition);
    // Singleton: only return exact lemma matches, not form matches
    const entries = allEntries.filter((e) => e.lemmaNormalized === normalized);
    if (entries.length === 0) return null;

    const sensesMap = await this.senseRepo.findByEntryIds(entries.map((e) => e.id));
    const entry = toDictionaryEntry(entries, sensesMap);

    // Find parent entries this lemma is a form of
    const parents = await this.entryRepo.findParentEntries(normalized, langCode, edition);
    entry.formOf = parents
      .filter((p) => p.lemmaNormalized !== normalized)
      .map((p) => ({ lemma: p.lemma, pos: p.pos || null, formAs: p.formTags }));

    return entry;
  }

  async search(
    q: string,
    edition?: string,
    langCode?: string,
    pos?: string,
    limit: number = 20,
    offset: number = 0,
  ): Promise<{ results: DictionaryEntry[]; hasMore: boolean }> {
    let entries = await this.entryRepo.searchByPrefix(q, langCode, pos, edition, limit + 1, offset);
    const hasMore = entries.length > limit;
    if (hasMore) entries = entries.slice(0, limit);
    return { results: await this.groupEntries(entries), hasMore };
  }

  private async groupEntries(entries: Entry[]): Promise<DictionaryEntry[]> {
    if (entries.length === 0) return [];

    const sensesMap = await this.senseRepo.findByEntryIds(entries.map((e) => e.id));

    const grouped = new Map<string, Entry[]>();
    for (const entry of entries) {
      const key = `${entry.lemmaNormalized}:${entry.langCode}:${entry.sourceEdition}`;
      const group = grouped.get(key);
      if (group) {
        group.push(entry);
      } else {
        grouped.set(key, [entry]);
      }
    }

    return Array.from(grouped.values()).map((rows) => toDictionaryEntry(rows, sensesMap));
  }
}

function toDictionaryEntry(rows: Entry[], sensesMap: SensesMap): DictionaryEntry {
  const first = rows[0];
  return {
    lemma: first.lemma,
    langCode: first.langCode,
    langName: first.langName,
    sourceEdition: first.sourceEdition,
    formOf: [],
    lexemes: rows.map((row) => toLexeme(row, sensesMap)),
  };
}

function toLexeme(entry: Entry, sensesMap: SensesMap): LexemeResponse {
  return {
    pos: entry.pos || null,
    etymologyIndex: entry.etymologyIndex,
    forms: entry.forms ?? [],
    senses: (sensesMap.get(entry.id) ?? []).map((s) => ({
      gloss: s.gloss,
      tags: s.tags ?? [],
      topics: s.topics ?? [],
      categories: s.categories ?? [],
      examples: s.examplesText ?? [],
    })),
  };
}
