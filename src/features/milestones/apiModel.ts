import { count, object, oneOf, string, timestamp, uuid } from '../../shared/http/validation';

export type ApiMilestone = {
  id: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  title: string;
  projectId: string;
  projectName: string;
  scope: 'unity' | 'server';
  dueDate: string | null;
  completed: boolean;
};
export type MilestoneDraft = {
  title: string;
  projectId: string;
  dueDate: string;
  completed: boolean;
};
export type MilestoneProjectOption = {
  id: string;
  name: string;
  scope: 'unity' | 'server';
  archived: boolean;
};
export type MilestonePage = { items: ApiMilestone[]; total: number; nextCursor: string | null };
export function milestoneDate(value: unknown): string {
  const date = string(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('올바른 기한을 입력해 주세요.');
  const [y, m, d] = date.split('-').map(Number);
  const days = [
    31,
    y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  if (y < 1 || y > 9999 || m < 1 || m > 12 || d < 1 || d > days[m - 1])
    throw new Error('올바른 기한을 입력해 주세요.');
  return date;
}
export function revision(value: unknown) {
  const n = count(value);
  if (!n) throw new Error('Invalid revision');
  return n;
}
export function parseMilestone(value: unknown): ApiMilestone {
  const row = object(value);
  const title = string(row.title);
  if (!title.trim() || title.length > 200 || typeof row.completed !== 'boolean')
    throw new Error('Invalid Milestone');
  return {
    id: uuid(row.id),
    revision: revision(row.revision),
    createdAt: timestamp(row.createdAt),
    updatedAt: timestamp(row.updatedAt),
    title,
    projectId: uuid(row.projectId),
    projectName: string(row.projectName),
    scope: oneOf(row.scope, ['unity', 'server']),
    dueDate: row.dueDate === null ? null : milestoneDate(row.dueDate),
    completed: row.completed,
  };
}
export function parseMilestonePage(value: unknown): MilestonePage {
  const row = object(value);
  if (!Array.isArray(row.items)) throw new Error('Invalid page');
  const items = row.items.map(parseMilestone);
  const total = count(row.total);
  const nextCursor = row.nextCursor === null ? null : string(row.nextCursor);
  if (
    new Set(items.map((x) => x.id)).size !== items.length ||
    nextCursor === '' ||
    total < items.length
  )
    throw new Error('Invalid page');
  return { items, total, nextCursor };
}
export function parseDeletedMilestone(value: unknown) {
  return { deletedId: uuid(object(value).deletedId) };
}
export function milestoneDraft(value?: ApiMilestone): MilestoneDraft {
  return {
    title: value?.title ?? '',
    projectId: value?.projectId ?? '',
    dueDate: value?.dueDate ?? '',
    completed: value?.completed ?? false,
  };
}
export function createBody(draft: MilestoneDraft) {
  const title = draft.title.trim();
  if (!title || title.length > 200) throw new Error('목표 제목은 1–200자로 입력해 주세요.');
  if (typeof draft.completed !== 'boolean') throw new Error('올바른 목표 상태를 선택해 주세요.');
  return {
    title,
    projectId: uuid(draft.projectId),
    dueDate: draft.dueDate === '' ? null : milestoneDate(draft.dueDate),
    completed: draft.completed,
  };
}
export function patchBody(baseline: ApiMilestone, draft: MilestoneDraft) {
  const before = createBody(milestoneDraft(baseline));
  const after = createBody(draft);
  const changes: Record<string, string | number | boolean | null> = {
    revision: revision(baseline.revision),
  };
  for (const key of Object.keys(after) as (keyof typeof after)[])
    if (after[key] !== before[key]) changes[key] = after[key];
  return changes;
}
export function todayDate(now = new Date()) {
  return `${String(now.getFullYear()).padStart(4, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
