import { describe, it, expect } from 'vitest';
import { mapKaikkiRecord } from '../../../src/domain/mappers/kaikki-mapper';
import { KaikkiRecord } from '../../../src/domain/schemas/kaikki';

describe('mapKaikkiRecord', () => {
  const baseRecord: KaikkiRecord = {
    word: 'chat',
    lang_code: 'fr',
    lang: 'French',
    pos: 'noun',
    senses: [
      {
        glosses: ['cat', 'domestic feline'],
        tags: ['masculine'],
        examples: [{ text: 'Le chat dort sur le canapé.' }],
      },
    ],
  };

  it('maps a valid Kaikki record to domain model', () => {
    const result = mapKaikkiRecord(baseRecord, 'fr');
    expect(result).not.toBeNull();
    expect(result!.entry.lemma).toBe('chat');
    expect(result!.entry.lemmaNormalized).toBe('chat');
    expect(result!.entry.langCode).toBe('fr');
    expect(result!.entry.langName).toBe('French');
    expect(result!.entry.pos).toBe('noun');
    expect(result!.entry.etymologyIndex).toBe(0);
  });

  it('extracts senses with joined glosses', () => {
    const result = mapKaikkiRecord(baseRecord, 'fr');
    expect(result!.senses).toHaveLength(1);
    expect(result!.senses[0].gloss).toBe('cat; domestic feline');
    expect(result!.senses[0].tags).toEqual(['masculine']);
    expect(result!.senses[0].examplesText).toEqual([
      'Le chat dort sur le canapé.',
    ]);
  });

  it('returns null for record without senses', () => {
    expect(mapKaikkiRecord({ ...baseRecord, senses: [] }, 'fr')).toBeNull();
  });

  it('returns null for record with empty word', () => {
    expect(mapKaikkiRecord({ ...baseRecord, word: '  ' }, 'fr')).toBeNull();
  });

  it('skips senses with empty glosses', () => {
    const record: KaikkiRecord = {
      ...baseRecord,
      senses: [{ glosses: [] }, { glosses: ['valid gloss'] }],
    };
    const result = mapKaikkiRecord(record, 'fr');
    expect(result!.senses).toHaveLength(1);
    expect(result!.senses[0].gloss).toBe('valid gloss');
    expect(result!.senses[0].senseIndex).toBe(1);
  });

  it('uses etymology_number when present', () => {
    const result = mapKaikkiRecord({ ...baseRecord, etymology_number: 2 }, 'fr');
    expect(result!.entry.etymologyIndex).toBe(2);
  });

  it('falls back to raw_glosses when glosses is missing', () => {
    const record: KaikkiRecord = {
      ...baseRecord,
      senses: [{ raw_glosses: ['a cat'] }],
    };
    const result = mapKaikkiRecord(record, 'fr');
    expect(result!.senses[0].gloss).toBe('a cat');
  });

  it('defaults pos to empty string when missing', () => {
    const record: KaikkiRecord = {
      word: 'test',
      lang_code: 'fr',
      senses: [{ glosses: ['a test'] }],
    };
    const result = mapKaikkiRecord(record, 'fr');
    expect(result!.entry.pos).toBe('');
  });

  it('stores raw JSON for traceability', () => {
    const result = mapKaikkiRecord(baseRecord, 'fr');
    expect(result!.entry.rawEntryJson).toBeDefined();
    expect(result!.senses[0].rawSenseJson).toBeDefined();
  });
});
