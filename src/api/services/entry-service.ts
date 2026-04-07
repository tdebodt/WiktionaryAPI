import { Pool } from 'pg';
import { EntryRepository } from '../../db/repositories/entry-repository';
import { SenseRepository } from '../../db/repositories/sense-repository';
import { NotFoundError } from '../../lib/errors';

export interface FormResponse {
  form: string;
  tags: string[];
}

export interface EntryWithSenses {
  entryId: number;
  lemma: string;
  langCode: string;
  langName: string | null;
  pos: string | null;
  forms: FormResponse[];
  senses: SenseResponse[];
}

export interface SenseResponse {
  senseId: number;
  senseIndex: number;
  gloss: string;
  tags: string[];
  topics: string[];
  categories: string[];
  examples: string[];
}

export class EntryService {
  private entryRepo: EntryRepository;
  private senseRepo: SenseRepository;

  constructor(pool: Pool) {
    this.entryRepo = new EntryRepository(pool);
    this.senseRepo = new SenseRepository(pool);
  }

  async getByLemma(
    lemma: string,
    langCode?: string,
    pos?: string,
  ): Promise<EntryWithSenses[]> {
    const entries = await this.entryRepo.findByNormalizedLemma(
      lemma,
      langCode,
      pos,
    );
    if (entries.length === 0) return [];

    const sensesMap = await this.senseRepo.findByEntryIds(
      entries.map((e) => e.id),
    );

    return entries.map((entry) => toEntryWithSenses(entry, sensesMap));
  }

  async search(
    query: string,
    langCode?: string,
    pos?: string,
    limit: number = 20,
    offset: number = 0,
  ): Promise<EntryWithSenses[]> {
    const entries = await this.entryRepo.searchByPrefix(
      query,
      langCode,
      pos,
      limit,
      offset,
    );
    if (entries.length === 0) return [];

    const sensesMap = await this.senseRepo.findByEntryIds(
      entries.map((e) => e.id),
    );

    return entries.map((entry) => toEntryWithSenses(entry, sensesMap));
  }

  async getSenseById(
    senseId: number,
  ): Promise<{ sense: SenseResponse; entry: EntryWithSenses }> {
    const sense = await this.senseRepo.findById(senseId);
    if (!sense) throw new NotFoundError(`Sense ${senseId} not found`);

    const entry = await this.entryRepo.findById(sense.entryId);
    if (!entry) throw new NotFoundError(`Entry for sense ${senseId} not found`);

    const allSenses = await this.senseRepo.findByEntryId(entry.id);
    const sensesMap = new Map([[entry.id, allSenses]]);

    return {
      sense: {
        senseId: sense.id,
        senseIndex: sense.senseIndex,
        gloss: sense.gloss,
        tags: sense.tags ?? [],
        topics: sense.topics ?? [],
        categories: sense.categories ?? [],
        examples: sense.examplesText ?? [],
      },
      entry: toEntryWithSenses(entry, sensesMap),
    };
  }
}

function toEntryWithSenses(
  entry: { id: number; lemma: string; langCode: string; langName: string | null; pos: string; forms: Array<{ form: string; tags: string[] }> | null },
  sensesMap: Map<number, Array<{ id: number; senseIndex: number; gloss: string; tags: string[] | null; topics: string[] | null; categories: string[] | null; examplesText: string[] | null }>>,
): EntryWithSenses {
  return {
    entryId: entry.id,
    lemma: entry.lemma,
    langCode: entry.langCode,
    langName: entry.langName,
    pos: entry.pos || null, // convert '' back to null for API responses
    forms: entry.forms ?? [],
    senses: (sensesMap.get(entry.id) ?? []).map((s) => ({
      senseId: s.id,
      senseIndex: s.senseIndex,
      gloss: s.gloss,
      tags: s.tags ?? [],
      topics: s.topics ?? [],
      categories: s.categories ?? [],
      examples: s.examplesText ?? [],
    })),
  };
}
