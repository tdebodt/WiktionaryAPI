import { z } from 'zod';

/**
 * Minimal Zod schema for Kaikki JSONL records.
 *
 * Kaikki records are complex and vary across languages/editions.
 * We validate only the fields we need for import and pass through
 * the rest as raw JSON for traceability.
 */

const KaikkiExampleSchema = z
  .object({
    text: z.string().optional(),
    english: z.string().optional(),
  })
  .passthrough();

const KaikkiSenseSchema = z
  .object({
    glosses: z.array(z.string()).optional(),
    raw_glosses: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
    examples: z.array(KaikkiExampleSchema).optional(),
  })
  .passthrough();

export const KaikkiRecordSchema = z
  .object({
    word: z.string(),
    lang_code: z.string(),
    lang: z.string().optional(),
    pos: z.string().optional(),
    etymology_number: z.number().optional(),
    etymology_text: z.string().optional(),
    senses: z.array(KaikkiSenseSchema).optional(),
  })
  .passthrough();

export type KaikkiRecord = z.infer<typeof KaikkiRecordSchema>;
export type KaikkiSense = z.infer<typeof KaikkiSenseSchema>;
