import { DictionaryEntry } from '../services/entry-service';

function escapeTurtle(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

function lit(value: string, lang: string): string {
  return `"${escapeTurtle(value)}"@${lang}`;
}

function uri(value: string): string {
  return `<${value}>`;
}

/**
 * Tags that indicate a derivational/lexical relationship — the form is
 * a genuinely different word that names the same (or closely related) concept.
 * Everything else (inflectional morphology, register qualifiers) is treated
 * as hiddenLabel — useful for discovery but not a true alternative name.
 *
 * Conservative by design: when in doubt, a tag is NOT in this set.
 */
const ALT_LABEL_TAGS: ReadonlySet<string> = new Set([
  // Derivational / word-formation
  'diminutive',
  'augmentative',
  'endearing',
  'pejorative',

  // Abbreviation / clipping
  'abbreviation',
  'clipping',
  'short-form',
  'initialism',
  'acronym',

  // Orthographic / script variants
  'alternative',
  'romanization',
  'transliteration',
]);

/**
 * Classify whether a form's tags indicate a lexical variant (altLabel)
 * or an inflectional form (hiddenLabel). If ANY tag is derivational,
 * the form qualifies as altLabel — e.g. ["diminutive", "singular"]
 * is alt because the diminutive tag signals a different lexeme.
 * Empty tags default to 'hidden' (conservative).
 */
function classifyFormTags(tags: string[]): 'alt' | 'hidden' {
  return tags.some((t) => ALT_LABEL_TAGS.has(t)) ? 'alt' : 'hidden';
}

export function toSkosTurtle(entry: DictionaryEntry, baseUrl: string): string {
  const entryUri = `${baseUrl}/editions/${entry.sourceEdition}/languages/${entry.langCode}/entries/${encodeURIComponent(entry.lemma)}`;
  const schemeUri = `${baseUrl}/editions/${entry.sourceEdition}`;
  const lang = entry.langCode;

  const lines: string[] = [];

  // Prefixes
  lines.push('@prefix skos: <http://www.w3.org/2004/02/skos/core#> .');
  lines.push('@prefix dct: <http://purl.org/dc/terms/> .');
  lines.push('');

  // ConceptScheme
  lines.push(`${uri(schemeUri)} a skos:ConceptScheme ;`);
  lines.push(`    skos:prefLabel "${entry.sourceEdition} Wiktionary"@en .`);
  lines.push('');

  for (const lex of entry.lexemes) {
    const posSlug = lex.pos || 'unknown';

    for (let si = 0; si < lex.senses.length; si++) {
      const sense = lex.senses[si];

      // Skip form-of senses — grammatical descriptions, not domain concepts
      if (sense.tags.includes('form-of')) continue;

      const conceptUri = `${entryUri}#${posSlug}-${lex.etymologyIndex}-s${si}`;

      const triples: string[] = [];
      triples.push(`${uri(conceptUri)} a skos:Concept`);
      triples.push(`    skos:prefLabel ${lit(entry.lemma, lang)}`);
      triples.push(`    skos:inScheme ${uri(schemeUri)}`);
      triples.push(`    skos:definition ${lit(sense.gloss, lang)}`);

      if (lex.pos) {
        triples.push(`    dct:type ${lit(lex.pos, "en")}`);
      }

      if (entry.langName) {
        triples.push(`    dct:language ${lit(entry.langName, lang)}`);
      }

      for (const ex of sense.examples) {
        triples.push(`    skos:example ${lit(ex, lang)}`);
      }

      for (const topic of sense.topics) {
        triples.push(`    dct:subject ${lit(topic, "en")}`);
      }

      // Collect altLabel / hiddenLabel from forms and formOf relationships.
      // Dedup by lowercased form; alt wins over hidden if both appear.
      const labelsByKey = new Map<string, { form: string; type: 'alt' | 'hidden' }>();
      const lemmaKey = entry.lemma.toLowerCase();

      // Forward: inflected/derived forms of this lexeme
      for (const f of lex.forms) {
        const key = f.form.toLowerCase();
        if (key === lemmaKey) continue;
        const cls = classifyFormTags(f.tags);
        const prev = labelsByKey.get(key);
        if (!prev || (cls === 'alt' && prev.type === 'hidden')) {
          labelsByKey.set(key, { form: f.form, type: cls });
        }
      }

      // Inverse: parent lemmas this entry is a form of
      for (const parent of entry.formOf) {
        const key = parent.lemma.toLowerCase();
        if (key === lemmaKey) continue;
        const cls = classifyFormTags(parent.formAs);
        const prev = labelsByKey.get(key);
        if (!prev || (cls === 'alt' && prev.type === 'hidden')) {
          labelsByKey.set(key, { form: parent.lemma, type: cls });
        }
      }

      for (const [, label] of labelsByKey) {
        const predicate = label.type === 'alt' ? 'skos:altLabel' : 'skos:hiddenLabel';
        triples.push(`    ${predicate} ${lit(label.form, lang)}`);
      }

      lines.push(triples.join(' ;\n') + ' .');
      lines.push('');
    }
  }

  return lines.join('\n');
}
