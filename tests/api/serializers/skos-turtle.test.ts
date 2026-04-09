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

  describe('altLabel / hiddenLabel', () => {
    it('adds inflectional forms as skos:hiddenLabel', () => {
      const entry = makeEntry({
        lexemes: [{
          pos: 'noun', etymologyIndex: 0,
          forms: [
            { form: 'houses', tags: ['plural'] },
            { form: 'housing', tags: ['gerund'] },
          ],
          senses: [{ gloss: 'A building', tags: [], topics: [], categories: [], examples: [] }],
        }],
      });
      const turtle = toSkosTurtle(entry, baseUrl);
      expect(turtle).toContain('skos:hiddenLabel "houses"@en');
      expect(turtle).toContain('skos:hiddenLabel "housing"@en');
      expect(turtle).not.toContain('skos:altLabel "houses"@en');
    });

    it('adds derivational forms as skos:altLabel', () => {
      const entry = makeEntry({
        lemma: 'huis', langCode: 'nl',
        lexemes: [{
          pos: 'noun', etymologyIndex: 0,
          forms: [
            { form: 'huisje', tags: ['diminutive', 'singular'] },
            { form: 'huisjes', tags: ['diminutive', 'plural'] },
          ],
          senses: [{ gloss: 'Een gebouw', tags: [], topics: [], categories: [], examples: [] }],
        }],
      });
      const turtle = toSkosTurtle(entry, baseUrl);
      expect(turtle).toContain('skos:altLabel "huisje"@nl');
      expect(turtle).toContain('skos:altLabel "huisjes"@nl');
    });

    it('does not add self as label', () => {
      const entry = makeEntry({
        lexemes: [{
          pos: 'noun', etymologyIndex: 0,
          forms: [{ form: 'house', tags: ['canonical'] }],
          senses: [{ gloss: 'A building', tags: [], topics: [], categories: [], examples: [] }],
        }],
      });
      const turtle = toSkosTurtle(entry, baseUrl);
      expect(turtle).not.toContain('skos:altLabel "house"@en');
      expect(turtle).not.toContain('skos:hiddenLabel "house"@en');
    });

    it('adds formOf parent as skos:hiddenLabel for inflectional relationship', () => {
      const entry = makeEntry({
        lemma: 'houses',
        formOf: [{ lemma: 'house', pos: 'noun', formAs: ['plural'] }],
      });
      const turtle = toSkosTurtle(entry, baseUrl);
      expect(turtle).toContain('skos:hiddenLabel "house"@en');
      expect(turtle).not.toContain('skos:altLabel "house"@en');
    });

    it('adds formOf parent as skos:altLabel for derivational relationship', () => {
      const entry = makeEntry({
        lemma: 'huisje', langCode: 'nl',
        formOf: [{ lemma: 'huis', pos: 'noun', formAs: ['diminutive', 'singular'] }],
        lexemes: [{
          pos: 'noun', etymologyIndex: 0, forms: [],
          senses: [{ gloss: 'Verkleinwoord van huis', tags: [], topics: [], categories: [], examples: [] }],
        }],
      });
      const turtle = toSkosTurtle(entry, baseUrl);
      expect(turtle).toContain('skos:altLabel "huis"@nl');
    });

    it('deduplicates labels — alt wins over hidden for same form', () => {
      const entry = makeEntry({
        lemma: 'huisje', langCode: 'nl',
        formOf: [{ lemma: 'huis', pos: 'noun', formAs: ['diminutive'] }],
        lexemes: [{
          pos: 'noun', etymologyIndex: 0,
          forms: [{ form: 'huis', tags: ['base-form'] }],
          senses: [{ gloss: 'Klein huis', tags: [], topics: [], categories: [], examples: [] }],
        }],
      });
      const turtle = toSkosTurtle(entry, baseUrl);
      const altMatches = turtle.match(/skos:altLabel "huis"@nl/g);
      expect(altMatches).toHaveLength(1);
      expect(turtle).not.toContain('skos:hiddenLabel "huis"@nl');
    });

    it('treats forms with empty tags as hiddenLabel (conservative)', () => {
      const entry = makeEntry({
        lexemes: [{
          pos: 'noun', etymologyIndex: 0,
          forms: [{ form: 'housen', tags: [] }],
          senses: [{ gloss: 'A building', tags: [], topics: [], categories: [], examples: [] }],
        }],
      });
      const turtle = toSkosTurtle(entry, baseUrl);
      expect(turtle).toContain('skos:hiddenLabel "housen"@en');
    });

    it('language-tags labels with entry langCode', () => {
      const entry = makeEntry({
        langCode: 'nl',
        lexemes: [{
          pos: 'noun', etymologyIndex: 0,
          forms: [{ form: 'huizen', tags: ['plural'] }],
          senses: [{ gloss: 'Een gebouw', tags: [], topics: [], categories: [], examples: [] }],
        }],
      });
      const turtle = toSkosTurtle(entry, baseUrl);
      expect(turtle).toContain('"huizen"@nl');
    });

    it('adds labels to every concept in the entry', () => {
      const entry = makeEntry({
        lexemes: [{
          pos: 'noun', etymologyIndex: 0,
          forms: [{ form: 'houses', tags: ['plural'] }],
          senses: [
            { gloss: 'A building', tags: [], topics: [], categories: [], examples: [] },
            { gloss: 'A legislative body', tags: [], topics: [], categories: [], examples: [] },
          ],
        }],
      });
      const turtle = toSkosTurtle(entry, baseUrl);
      const matches = turtle.match(/skos:hiddenLabel "houses"@en/g);
      expect(matches).toHaveLength(2);
    });

    it('classifies abbreviation as altLabel', () => {
      const entry = makeEntry({
        lexemes: [{
          pos: 'noun', etymologyIndex: 0,
          forms: [{ form: 'govt', tags: ['abbreviation'] }],
          senses: [{ gloss: 'A governing body', tags: [], topics: [], categories: [], examples: [] }],
        }],
        lemma: 'government',
      });
      const turtle = toSkosTurtle(entry, baseUrl);
      expect(turtle).toContain('skos:altLabel "govt"@en');
    });

    it('does not promote register-only tags to altLabel', () => {
      const entry = makeEntry({
        lexemes: [{
          pos: 'noun', etymologyIndex: 0,
          forms: [{ form: 'housen', tags: ['archaic', 'plural'] }],
          senses: [{ gloss: 'A building', tags: [], topics: [], categories: [], examples: [] }],
        }],
      });
      const turtle = toSkosTurtle(entry, baseUrl);
      expect(turtle).toContain('skos:hiddenLabel "housen"@en');
      expect(turtle).not.toContain('skos:altLabel "housen"@en');
    });

    it('subtracts inherited formOf tags when classifying own forms', () => {
      // "huisje" is a diminutive of "huis". Its form "huisjes" has tags
      // ["diminutive", "plural"] — but the "diminutive" is inherited context,
      // not a new derivation. "huisjes" is just the plural of "huisje".
      const entry = makeEntry({
        lemma: 'huisje', langCode: 'nl',
        formOf: [{ lemma: 'huis', pos: 'noun', formAs: ['diminutive', 'singular'] }],
        lexemes: [{
          pos: 'noun', etymologyIndex: 0,
          forms: [{ form: 'huisjes', tags: ['diminutive', 'plural'] }],
          senses: [{ gloss: 'Klein huis', tags: [], topics: [], categories: [], examples: [] }],
        }],
      });
      const turtle = toSkosTurtle(entry, baseUrl);
      expect(turtle).toContain('skos:hiddenLabel "huisjes"@nl');
      expect(turtle).not.toContain('skos:altLabel "huisjes"@nl');
    });

    it('still promotes forms with non-inherited derivational tags', () => {
      // Entry is a diminutive of something, but has a form that is
      // ALSO an abbreviation — abbreviation is not inherited, so it promotes.
      const entry = makeEntry({
        lemma: 'huisje', langCode: 'nl',
        formOf: [{ lemma: 'huis', pos: 'noun', formAs: ['diminutive'] }],
        lexemes: [{
          pos: 'noun', etymologyIndex: 0,
          forms: [{ form: 'hsj', tags: ['diminutive', 'abbreviation'] }],
          senses: [{ gloss: 'Klein huis', tags: [], topics: [], categories: [], examples: [] }],
        }],
      });
      const turtle = toSkosTurtle(entry, baseUrl);
      expect(turtle).toContain('skos:altLabel "hsj"@nl');
    });
  });
});
