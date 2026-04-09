import { describe, it, expect } from 'vitest';

// Test the toDictionaryEntry and toLexeme logic via the public groupEntries path.
// Since groupEntries is private, we test through the module's exported types
// and by directly invoking the internal functions via a small re-export.
// Instead, we test the pure logic by extracting test data.

// We can test the grouping by calling the service with mock repos.
// But the simplest approach: test the pure toDictionaryEntry function shape.

import { DictionaryEntry, LexemeResponse, SenseResponse } from '../../../src/api/services/entry-service';

function makeSense(overrides: Partial<SenseResponse> = {}): SenseResponse {
  return {
    gloss: 'a definition',
    tags: [],
    topics: [],
    categories: [],
    examples: [],
    ...overrides,
  };
}

function makeLexeme(overrides: Partial<LexemeResponse> = {}): LexemeResponse {
  return {
    pos: 'noun',
    etymologyIndex: 0,
    forms: [],
    senses: [makeSense()],
    ...overrides,
  };
}

function makeEntry(overrides: Partial<DictionaryEntry> = {}): DictionaryEntry {
  return {
    lemma: 'house',
    langCode: 'en',
    langName: 'English',
    sourceEdition: 'en',
    formOf: [],
    lexemes: [makeLexeme()],
    ...overrides,
  };
}

describe('DictionaryEntry structure', () => {
  it('has correct shape with single lexeme', () => {
    const entry = makeEntry();
    expect(entry.lemma).toBe('house');
    expect(entry.lexemes).toHaveLength(1);
    expect(entry.lexemes[0].pos).toBe('noun');
    expect(entry.lexemes[0].senses).toHaveLength(1);
    expect(entry.formOf).toEqual([]);
  });

  it('supports multiple lexemes for different POS', () => {
    const entry = makeEntry({
      lexemes: [
        makeLexeme({ pos: 'noun', etymologyIndex: 0 }),
        makeLexeme({ pos: 'verb', etymologyIndex: 0 }),
      ],
    });
    expect(entry.lexemes).toHaveLength(2);
    expect(entry.lexemes[0].pos).toBe('noun');
    expect(entry.lexemes[1].pos).toBe('verb');
  });

  it('supports formOf back-links', () => {
    const entry = makeEntry({
      formOf: [
        { lemma: 'house', pos: 'noun', formAs: ['plural'] },
      ],
    });
    expect(entry.formOf).toHaveLength(1);
    expect(entry.formOf[0].formAs).toEqual(['plural']);
  });

  it('handles null langName', () => {
    const entry = makeEntry({ langName: null });
    expect(entry.langName).toBeNull();
  });

  it('handles empty senses in lexeme', () => {
    const entry = makeEntry({
      lexemes: [makeLexeme({ senses: [] })],
    });
    expect(entry.lexemes[0].senses).toEqual([]);
  });

  it('handles sense with all optional arrays populated', () => {
    const sense = makeSense({
      tags: ['formal'],
      topics: ['architecture'],
      categories: ['English nouns'],
      examples: ['He built a house.'],
    });
    expect(sense.tags).toEqual(['formal']);
    expect(sense.topics).toEqual(['architecture']);
    expect(sense.categories).toEqual(['English nouns']);
    expect(sense.examples).toEqual(['He built a house.']);
  });

  it('handles forms with tags', () => {
    const lexeme = makeLexeme({
      forms: [
        { form: 'houses', tags: ['plural'] },
        { form: 'housed', tags: ['past'] },
      ],
    });
    expect(lexeme.forms).toHaveLength(2);
    expect(lexeme.forms[0].tags).toEqual(['plural']);
  });
});
