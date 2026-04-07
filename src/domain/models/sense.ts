export interface Sense {
  id: number;
  entryId: number;
  senseIndex: number;
  gloss: string;
  tags: string[] | null;
  topics: string[] | null;
  categories: string[] | null;
  examplesText: string[] | null;
}

export interface NewSense {
  entryId: number;
  senseIndex: number;
  gloss: string;
  tags: string[] | null;
  topics: string[] | null;
  categories: string[] | null;
  examplesText: string[] | null;
  rawSenseJson: Record<string, unknown> | null;
}
