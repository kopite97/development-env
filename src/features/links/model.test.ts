import { describe, it, expect } from 'vitest';
import { initialLinks, isLinks, moveLink, validUrl } from './model';
describe('link storage', () => {
  it('accepts defaults and preserves an intentionally empty list', () => {
    expect(isLinks(initialLinks)).toBe(true);
    expect(isLinks([])).toBe(true);
    expect(isLinks([...initialLinks, initialLinks[0]])).toBe(false);
    expect(isLinks([{ ...initialLinks[0], scope: 'invalid' }])).toBe(false);
  });
  it('rejects unsafe or malformed URLs from forms and storage', () => {
    for (const url of [
      'javascript:alert(1)',
      'data:text/html,test',
      '/relative',
      'https://',
      'https://user:secret@example.com',
    ]) {
      expect(validUrl(url)).toBe(false);
      expect(isLinks([{ ...initialLinks[0], url }])).toBe(false);
    }
    expect(validUrl('https://example.com/path?q=1#section')).toBe(true);
  });
  it('moves without mutating and keeps boundary positions', () => {
    expect(moveLink(initialLinks, 'unity', -1).map((l) => l.id)).toEqual([
      'unity',
      'github',
      'spring',
      'react',
    ]);
    expect(initialLinks[0].id).toBe('github');
    expect(moveLink(initialLinks, 'github', -1)).toBe(initialLinks);
  });
});
