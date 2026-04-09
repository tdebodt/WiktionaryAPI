import { describe, it, expect } from 'vitest';
import { toSkosTurtle } from '../../../src/api/serializers/skos-turtle';
import { DictionaryEntry } from '../../../src/api/services/entry-service';

function makeEntry(overrides: Partial<DictionaryEntry> = {}): DictionaryEntry {
  return {
    lemma: 'house',
    langCode: 'en',
    langName: 'English',
    sourceEdition: 'en',
    formOf: [],
    lexemes: [{
      pos: 'noun',
      etymologyIndex: 0,
      forms: [],
      senses: [{
        gloss: 'A building for habitation',
        tags: [],
        topics: [],
        categories: [],
        examples: [],
      }],
    }],
    ...overrides,
  };
}

describe('toSkosTurtle', () => {
  const baseUrl = 'http://localhost:3000';

  it('includes SKOS and DCT prefixes', () => {
    const turtle = toSkosTurtle(makeEntry(), baseUrl);
    expect(turtle).toContain('@prefix skos: <http://www.w3.org/2004/02/skos/core#>');
    expect(turtle).toContain('@prefix dct: <http://purl.org/dc/terms/>');
  });

  it('creates a ConceptScheme for the edition', () => {
    const turtle = toSkosTurtle(makeEntry(), baseUrl);
    expect(turtle).toContain('<http://localhost:3000/editions/en> a skos:ConceptScheme');
    expect(turtle).toContain('skos:prefLabel "en Wiktionary"@en');
  });

  it('creates a skos:Concept for each genuine sense', () => {
    const turtle = toSkosTurtle(makeEntry(), baseUrl);
    expect(turtle).toContain('a skos:Concept');
    expect(turtle).toContain('skos:definition "A building for habitation"@en');
    expect(turtle).toContain('skos:prefLabel "house"@en');
  });

  it('filters out form-of senses', () => {
    const entry = makeEntry({
      lexemes: [{
        pos: 'noun',
        etymologyIndex: 0,
        forms: [],
        senses: [
          { gloss: 'plural of house', tags: ['form-of'], topics: [], categories: [], examples: [] },
          { gloss: 'A building', tags: [], topics: [], categories: [], examples: [] },
        ],
      }],
    });
    const turtle = toSkosTurtle(entry, baseUrl);
    expect(turtle).not.toContain('plural of house');
    expect(turtle).toContain('A building');
  });

  it('includes examples when present', () => {
    const entry = makeEntry({
      lexemes: [{
        pos: 'noun',
        etymologyIndex: 0,
        forms: [],
        senses: [{
          gloss: 'A building',
          tags: [],
          topics: [],
          categories: [],
          examples: ['He built a house.'],
        }],
      }],
    });
    const turtle = toSkosTurtle(entry, baseUrl);
    expect(turtle).toContain('skos:example "He built a house."@en');
  });

  it('includes topics as dct:subject', () => {
    const entry = makeEntry({
      lexemes: [{
        pos: 'noun',
        etymologyIndex: 0,
        forms: [],
        senses: [{
          gloss: 'A building',
          tags: [],
          topics: ['architecture'],
          categories: [],
          examples: [],
        }],
      }],
    });
    const turtle = toSkosTurtle(entry, baseUrl);
    expect(turtle).toContain('dct:subject "architecture"@en');
  });

  it('includes POS as dct:type', () => {
    const turtle = toSkosTurtle(makeEntry(), baseUrl);
    expect(turtle).toContain('dct:type "noun"@en');
  });

  it('includes language as dct:language', () => {
    const turtle = toSkosTurtle(makeEntry(), baseUrl);
    expect(turtle).toContain('dct:language "English"@en');
  });

  it('omits dct:language when langName is null', () => {
    const entry = makeEntry({ langName: null });
    const turtle = toSkosTurtle(entry, baseUrl);
    expect(turtle).not.toContain('dct:language');
  });

  it('escapes special characters in literals', () => {
    const entry = makeEntry({
      lexemes: [{
        pos: 'noun',
        etymologyIndex: 0,
        forms: [],
        senses: [{
          gloss: 'A "big" house\nwith tabs\there',
          tags: [],
          topics: [],
          categories: [],
          examples: [],
        }],
      }],
    });
    const turtle = toSkosTurtle(entry, baseUrl);
    expect(turtle).toContain('A \\"big\\" house\\nwith tabs\\there');
  });

  it('generates correct concept URIs with POS and index', () => {
    const turtle = toSkosTurtle(makeEntry(), baseUrl);
    expect(turtle).toContain('#noun-0-s0');
  });

  it('handles multiple lexemes with multiple senses', () => {
    const entry = makeEntry({
      lexemes: [
        {
          pos: 'noun',
          etymologyIndex: 0,
          forms: [],
          senses: [
            { gloss: 'Sense 1', tags: [], topics: [], categories: [], examples: [] },
            { gloss: 'Sense 2', tags: [], topics: [], categories: [], examples: [] },
          ],
        },
        {
          pos: 'verb',
          etymologyIndex: 1,
          forms: [],
          senses: [
            { gloss: 'Sense 3', tags: [], topics: [], categories: [], examples: [] },
          ],
        },
      ],
    });
    const turtle = toSkosTurtle(entry, baseUrl);
    expect(turtle).toContain('Sense 1');
    expect(turtle).toContain('Sense 2');
    expect(turtle).toContain('Sense 3');
    expect(turtle).toContain('#noun-0-s0');
    expect(turtle).toContain('#noun-0-s1');
    expect(turtle).toContain('#verb-1-s0');
  });
});
