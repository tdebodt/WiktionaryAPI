import { describe, it, expect } from 'vitest';
import { KaikkiRecordSchema } from '../../src/domain/schemas/kaikki';

describe('Kaikki JSONL parsing', () => {
  it('parses a minimal valid record', () => {
    const result = KaikkiRecordSchema.safeParse({
      word: 'bonjour',
      lang_code: 'fr',
    });
    expect(result.success).toBe(true);
  });

  it('parses a full record with senses', () => {
    const result = KaikkiRecordSchema.safeParse({
      word: 'maison',
      lang_code: 'fr',
      lang: 'French',
      pos: 'noun',
      etymology_number: 1,
      etymology_text: 'From Latin mansio',
      senses: [
        {
          glosses: ['house', 'home'],
          tags: ['feminine'],
          examples: [
            { text: 'Ma maison est grande.', english: 'My house is big.' },
          ],
        },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.word).toBe('maison');
      expect(result.data.senses).toHaveLength(1);
      expect(result.data.senses![0].glosses).toEqual(['house', 'home']);
    }
  });

  it('rejects records without word', () => {
    const result = KaikkiRecordSchema.safeParse({ lang_code: 'fr' });
    expect(result.success).toBe(false);
  });

  it('rejects records without lang_code', () => {
    const result = KaikkiRecordSchema.safeParse({ word: 'test' });
    expect(result.success).toBe(false);
  });

  it('allows extra fields via passthrough', () => {
    const result = KaikkiRecordSchema.safeParse({
      word: 'test',
      lang_code: 'fr',
      some_extra_field: 'extra',
      nested: { data: true },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(
        (result.data as Record<string, unknown>).some_extra_field,
      ).toBe('extra');
    }
  });
});
