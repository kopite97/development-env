import { type Scope } from '../projects/scope';
export type QuickLink = { id: string; label: string; desc: string; url: string; scope: Scope };
export function validUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      ['http:', 'https:'].includes(url.protocol) && !!url.hostname && !url.username && !url.password
    );
  } catch {
    return false;
  }
}
export const initialLinks: QuickLink[] = [
  { id: 'github', label: 'GitHub', desc: '코드와 저장소', url: 'https://github.com', scope: 'all' },
  {
    id: 'unity',
    label: 'Unity Documentation',
    desc: '게임 개발 레퍼런스',
    url: 'https://docs.unity3d.com',
    scope: 'unity',
  },
  {
    id: 'spring',
    label: 'Spring Documentation',
    desc: '서버 개발 레퍼런스',
    url: 'https://docs.spring.io',
    scope: 'server',
  },
  {
    id: 'react',
    label: 'React Documentation',
    desc: '프론트엔드 레퍼런스',
    url: 'https://react.dev',
    scope: 'server',
  },
];
export function isLinks(value: unknown): value is QuickLink[] {
  return (
    Array.isArray(value) &&
    value.every(
      (l) =>
        l &&
        typeof l.id === 'string' &&
        !!l.id &&
        typeof l.label === 'string' &&
        !!l.label.trim() &&
        l.label.length <= 100 &&
        typeof l.desc === 'string' &&
        l.desc.length <= 300 &&
        typeof l.url === 'string' &&
        l.url.length <= 2000 &&
        validUrl(l.url) &&
        ['all', 'unity', 'server'].includes(l.scope),
    ) &&
    new Set(value.map((l) => l.id)).size === value.length
  );
}
export function moveLink(links: QuickLink[], id: string, direction: -1 | 1): QuickLink[] {
  const index = links.findIndex((l) => l.id === id);
  const next = index + direction;
  if (index < 0 || next < 0 || next >= links.length) return links;
  const result = [...links];
  [result[index], result[next]] = [result[next], result[index]];
  return result;
}
