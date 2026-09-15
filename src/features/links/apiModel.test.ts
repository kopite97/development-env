import { describe, it, expect } from 'vitest';
import { createBody, parseCollection, parseLink, patchBody, linkIcon } from './apiModel';
import { createIntent, retryBody } from './apiIntent';
const dto = {
  id: '00000000-0000-0000-0000-000000000001',
  revision: 1,
  position: 4,
  createdAt: '2026-09-14T00:00:00Z',
  updatedAt: '2026-09-14T00:00:00Z',
  label: 'GitHub',
  description: '  keep  ',
  url: 'https://github.com',
  projectId: null,
  projectName: null,
  categoryId: null,
};
describe('Link boundary', () => {
  it('separates drafts and server authority while preserving description', () => {
    expect(createBody(dto)).toEqual({
      label: 'GitHub',
      description: '  keep  ',
      url: 'https://github.com',
      projectId: null,
    });
    expect(patchBody(dto, { ...dto, label: 'changed' })).toEqual({ revision: 1, label: 'changed' });
    expect(linkIcon(dto.url)).toBe('github');
    expect(linkIcon('https://github.com.evil.example')).toBe('');
  });
  it('rejects malformed authority, unsafe URL, invalid collection and pagination', () => {
    for (const change of [
      { id: 'github' },
      { revision: 0 },
      { revision: Number.MAX_SAFE_INTEGER + 1 },
      { position: -1 },
      { createdAt: 'today' },
      { projectId: 'common' },
      { url: 'javascript:alert(1)' },
      { url: 'https://u:p@example.com' },
      { description: null },
    ])
      expect(() => parseLink({ ...dto, ...change })).toThrow();
    const page = { items: [dto], total: 1, nextCursor: null, collectionRevision: 0 };
    expect(parseCollection(page).items[0].position).toBe(4);
    for (const change of [
      { total: 2 },
      { nextCursor: 'cursor' },
      { collectionRevision: -1 },
      { items: [dto, dto], total: 2 },
    ])
      expect(() => parseCollection({ ...page, ...change })).toThrow();
  });
  it('freezes exact create intent including whitespace and expires explicit replay', () => {
    const intent = createIntent(dto, 1000);
    expect(retryBody(intent, 2000)).toBe(intent.body);
    expect(intent.body.description).toBe('  keep  ');
    expect(Object.isFrozen(intent.body)).toBe(true);
    expect(() => retryBody(intent, 86401000)).toThrow();
  });
});
