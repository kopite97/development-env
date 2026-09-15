import { count, object, string, timestamp, uuid } from '../../shared/http/validation';
import { validUrl } from './model';

export type LinkDraft = {
  label: string;
  description: string;
  url: string;
  projectId: string | null;
};
export type ApiLink = LinkDraft & {
  projectName: string | null;
  categoryId: string | null;
  id: string;
  revision: number;
  position: number;
  createdAt: string;
  updatedAt: string;
};
export type LinkCollection = {
  items: ApiLink[];
  total: number;
  nextCursor: null;
  collectionRevision: number;
};
export const linkDraft = (link?: ApiLink): LinkDraft => ({
  label: link?.label ?? '',
  description: link?.description ?? '',
  url: link?.url ?? '',
  projectId: link?.projectId ?? null,
});
export function revision(value: unknown) {
  const n = count(value);
  if (!n) throw new Error('Invalid Link revision');
  return n;
}
export function createBody(draft: LinkDraft): LinkDraft {
  const label = string(draft.label).trim();
  const url = string(draft.url).trim();
  const description = string(draft.description);
  const projectId = draft.projectId === null ? null : uuid(draft.projectId);
  if (
    !label ||
    label.length > 100 ||
    url.length > 2000 ||
    !validUrl(url) ||
    description.length > 300
  )
    throw new Error(
      '이름과 올바른 http 또는 https URL을 입력해 주세요. 인증 정보가 포함된 URL은 사용할 수 없습니다.',
    );
  return { label, description, url, projectId };
}
export function patchBody(baseline: ApiLink, draft: LinkDraft) {
  const values = createBody(draft);
  const body: Partial<LinkDraft> & { revision: number } = { revision: baseline.revision };
  if (values.label !== baseline.label) body.label = values.label;
  if (values.description !== baseline.description) body.description = values.description;
  if (values.url !== baseline.url) body.url = values.url;
  if (values.projectId !== baseline.projectId) body.projectId = values.projectId;
  return body;
}
export function parseLink(value: unknown): ApiLink {
  const v = object(value);
  const draft = {
    label: string(v.label),
    description: string(v.description),
    url: string(v.url),
    projectId: v.projectId === null ? null : uuid(v.projectId),
  };
  createBody(draft);
  if (draft.label.length > 100 || draft.url.length > 2000) throw new Error('Invalid Link text');
  return {
    ...draft,
    projectName: v.projectName === null ? null : string(v.projectName),
    categoryId: v.categoryId === null ? null : uuid(v.categoryId),
    id: uuid(v.id),
    revision: revision(v.revision),
    position: count(v.position),
    createdAt: timestamp(v.createdAt),
    updatedAt: timestamp(v.updatedAt),
  };
}
export function parseCollection(value: unknown): LinkCollection {
  const v = object(value);
  if (!Array.isArray(v.items) || v.items.length > 500 || v.nextCursor !== null)
    throw new Error('Invalid Link collection');
  const items = v.items.map(parseLink);
  if (
    count(v.total) !== items.length ||
    new Set(items.map((l) => l.id)).size !== items.length ||
    new Set(items.map((l) => l.position)).size !== items.length ||
    items.some((l, i) => i > 0 && items[i - 1].position >= l.position)
  )
    throw new Error('Invalid Link order or total');
  return {
    items,
    total: items.length,
    nextCursor: null,
    collectionRevision: count(v.collectionRevision),
  };
}
export function parseMutation(value: unknown) {
  const v = object(value);
  return { item: parseLink(v.item), collectionRevision: count(v.collectionRevision) };
}
export function parseDeletion(value: unknown) {
  const v = object(value);
  return { deletedId: uuid(v.deletedId), collectionRevision: count(v.collectionRevision) };
}
export function linkIcon(url: string) {
  const host = new URL(url).hostname;
  return (
    (
      {
        'github.com': 'github',
        'docs.unity3d.com': 'unity',
        'docs.spring.io': 'spring',
        'react.dev': 'react',
      } as Record<string, string>
    )[host] ?? ''
  );
}
