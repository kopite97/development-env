import { type Scope } from '../projects/scope';
export const widgetTypes = [
  'overview',
  'board',
  'deploy',
  'links',
  'journal',
  'milestone',
] as const;
export type WidgetType = (typeof widgetTypes)[number];
export type Widget = {
  id: string;
  type: WidgetType;
  scope: Scope;
  title: string;
  size: 'small' | 'medium' | 'wide';
};
export const defaultLayout: Widget[] = [
  {
    id: 'overview',
    type: 'overview',
    scope: 'unity',
    title: '프로젝트 한눈에 보기',
    size: 'medium',
  },
  { id: 'deploy', type: 'deploy', scope: 'server', title: '운영 · 배포 현황', size: 'small' },
  { id: 'board', type: 'board', scope: 'unity', title: '작업 보드', size: 'medium' },
  { id: 'links', type: 'links', scope: 'all', title: '빠른 링크', size: 'small' },
  { id: 'journal', type: 'journal', scope: 'all', title: '최근 개발 일지', size: 'medium' },
  { id: 'milestone', type: 'milestone', scope: 'unity', title: '다가오는 마일스톤', size: 'small' },
];
export function isLayout(value: unknown): value is Widget[] {
  return (
    Array.isArray(value) &&
    value.every(
      (w) =>
        w &&
        typeof w.id === 'string' &&
        widgetTypes.includes(w.type) &&
        ['all', 'unity', 'server'].includes(w.scope) &&
        typeof w.title === 'string' &&
        ['small', 'medium', 'wide'].includes(w.size),
    ) &&
    new Set(value.map((w) => w.id)).size === value.length
  );
}
export function moveWidget(layout: Widget[], id: string, targetId: string) {
  const from = layout.findIndex((w) => w.id === id),
    to = layout.findIndex((w) => w.id === targetId);
  if (from < 0 || to < 0 || from === to) return layout;
  const next = [...layout];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
