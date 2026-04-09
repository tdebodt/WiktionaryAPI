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

      lines.push(triples.join(' ;\n') + ' .');
      lines.push('');
    }
  }

  return lines.join('\n');
}
