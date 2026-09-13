import { describe, expect, it } from 'vitest';
import {
  createBody,
  journalDate,
  parseDeletedJournal,
  parseJournal,
  parseJournalPage,
  patchBody,
  presentation,
  journalDraft,
  validateJournalDraft,
} from './apiModel';

const dto = {
  id: '00000000-0000-0000-0000-000000000009',
  revision: 4,
  createdAt: '2026-09-13T00:00:00Z',
  updatedAt: '2026-09-13T01:00:00Z',
  title: '  Keep the title  ',
  projectId: '00000000-0000-0000-0000-000000000001',
  projectName: 'Journal Project',
  scope: 'server',
  body: ' first line\n\nsecond line  ',
  entryDate: '2026-02-28',
};

describe('server Journal DTO boundary', () => {
  it('keeps entryDate separate from audit timestamps and preserves text exactly', () => {
    const journal = parseJournal(dto);
    expect(journal.entryDate).toBe('2026-02-28');
    expect(journal.createdAt).toBe(dto.createdAt);
    expect(journal.body).toBe(dto.body);
    expect(presentation(journal)).toMatchObject({
      project: 'Journal Project',
      scope: 'server',
      entryDate: '2026-02-28',
      body: dto.body,
    });
    expect(createBody(journalDraft(journal))).toEqual({
      title: dto.title,
      projectId: dto.projectId,
      body: dto.body,
      entryDate: dto.entryDate,
    });
  });

  it('validates calendar dates without timezone conversion', () => {
    expect(journalDate('2024-02-29')).toBe('2024-02-29');
    expect(() => journalDate('2026-02-29')).toThrow();
    expect(() => journalDate('2026-02-30')).toThrow();
    expect(() => journalDate('2026-02-03T12:00:00Z')).toThrow();
  });

  it('serializes only dirty fields while retaining whitespace and empty values', () => {
    const journal = parseJournal(dto);
    const draft = { ...journalDraft(journal), body: 'changed\n  body', projectId: dto.projectId };
    expect(patchBody(journal, draft)).toEqual({
      revision: 4,
      body: 'changed\n  body',
    });
    expect(() => patchBody(journal, { ...draft, title: '' })).toThrow();
    expect(validateJournalDraft({ ...draft, body: '   ' })).toHaveProperty('body');
  });

  it('rejects malformed responses and parses pagination and permanent-delete responses', () => {
    expect(parseJournalPage({ items: [dto], total: 1, nextCursor: 'cursor-1' })).toMatchObject({
      total: 1,
      nextCursor: 'cursor-1',
    });
    expect(parseDeletedJournal({ deletedId: dto.id })).toEqual({ deletedId: dto.id });
    expect(() => parseJournal({ ...dto, entryDate: '2026-02-30' })).toThrow();
    expect(() => parseJournal({ ...dto, revision: Number.MAX_SAFE_INTEGER + 1 })).toThrow();
    expect(() => parseJournalPage({ items: [dto], total: 1, nextCursor: '' })).toThrow();
  });
});
