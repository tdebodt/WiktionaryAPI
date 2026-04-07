export interface EntryForm {
  form: string;
  tags: string[];
}

export interface Entry {
  id: number;
  lemma: string;
  lemmaNormalized: string;
  langCode: string;
  langName: string | null;
  pos: string;
  etymologyIndex: number;
  sourceWord: string | null;
  forms: EntryForm[] | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewEntry {
  lemma: string;
  lemmaNormalized: string;
  langCode: string;
  langName: string | null;
  pos: string;
  etymologyIndex: number;
  sourceWord: string | null;
  forms: EntryForm[] | null;
  rawEntryJson: Record<string, unknown> | null;
}
