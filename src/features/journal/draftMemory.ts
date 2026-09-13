import type { ApiJournal, JournalDraft } from './apiModel';
import type { JournalCreateIntent } from './apiIntent';

export type JournalEditorMemory = {
  target: string;
  draft: JournalDraft;
  baseline?: ApiJournal;
  intent?: JournalCreateIntent;
  notice?: string;
};
export type JournalMemory = { editor?: JournalEditorMemory };
